from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.models import Proposal, Channel, User, InflowEvent, ProposalType, ProposalStatus
from app.services.bmoni_client import bmoni_client
from app.config import get_settings
from eth_account import Account

router = APIRouter()


class ProposalCreate(BaseModel):
    channel_id: str
    inflow_event_id: str
    type: ProposalType
    amount: float
    to_user_id: Optional[str] = None
    currency: Optional[str] = "CNGN"
    from_stablecoin: Optional[str] = "USDB"
    to_stablecoin: Optional[str] = "CNGN"


@router.post("/channels/{channel_id}/proposal")
async def create_proposal(channel_id: str, request: ProposalCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    user_result = await db.execute(select(User).where(User.id == channel.user_id))
    user = user_result.scalar_one_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    proposal_data = {}
    if request.type == ProposalType.TRANSFER:
        proposal_data = {"type": "TRANSFER", "toUserId": request.to_user_id, "amount": str(request.amount), "currency": request.currency, "description": "Split transfer"}
    elif request.type == ProposalType.SWAP:
        proposal_data = {"type": "SWAP", "fromStablecoin": request.from_stablecoin, "toStablecoin": request.to_stablecoin, "fromAmount": str(request.amount), "slippageBps": 50}

    bmoni_response = await bmoni_client.create_proposal(user.bmoni_user_id, "default-wallet", proposal_data)
    bmoni_proposal_id = bmoni_response.get("data", {}).get("proposal", {}).get("id")

    proposal = Proposal(
        inflow_event_id=request.inflow_event_id,
        channel_id=channel.id,
        bmoni_proposal_id=bmoni_proposal_id,
        type=request.type,
        amount=request.amount,
        status=ProposalStatus.PENDING_APPROVALS
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)

    return {"proposal_id": str(proposal.id), "status": proposal.status}


@router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    channel_result = await db.execute(select(Channel).where(Channel.id == proposal.channel_id))
    channel = channel_result.scalar_one_or_none()
    user_result = await db.execute(select(User).where(User.id == channel.user_id))
    user = user_result.scalar_one_or_none()

    await bmoni_client.approve_proposal(user.bmoni_user_id, proposal.bmoni_proposal_id)
    proposal.status = ProposalStatus.PENDING_SIGNATURES
    await db.commit()

    return {"proposal_id": str(proposal.id), "status": proposal.status}


@router.get("/proposals/{proposal_id}/sign-payload")
async def get_sign_payload(proposal_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    channel_result = await db.execute(select(Channel).where(Channel.id == proposal.channel_id))
    channel = channel_result.scalar_one_or_none()
    user_result = await db.execute(select(User).where(User.id == channel.user_id))
    user = user_result.scalar_one_or_none()

    response = await bmoni_client.get_sign_payload(user.bmoni_user_id, proposal.bmoni_proposal_id)
    return {"hash_to_sign": response.get("data", {}).get("hashToSign")}


@router.post("/proposals/{proposal_id}/sign")
async def sign_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    channel_result = await db.execute(select(Channel).where(Channel.id == proposal.channel_id))
    channel = channel_result.scalar_one_or_none()
    user_result = await db.execute(select(User).where(User.id == channel.user_id))
    user = user_result.scalar_one_or_none()

    settings = get_settings()
    account = Account.from_key(settings.DEMO_WALLET_OWNER_PRIVATE_KEY)

    sign_response = await bmoni_client.get_sign_payload(user.bmoni_user_id, proposal.bmoni_proposal_id)
    hash_to_sign = sign_response.get("data", {}).get("hashToSign")

    signed = account.unsafe_sign_hash(hash_to_sign)
    signature = signed.signature.hex()

    await bmoni_client.sign_proposal(user.bmoni_user_id, proposal.bmoni_proposal_id, f"0x{signature}")
    proposal.status = ProposalStatus.COMPLETED
    await db.commit()

    return {"proposal_id": str(proposal.id), "status": proposal.status}


@router.get("/proposals/{proposal_id}")
async def get_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"id": str(proposal.id), "status": proposal.status, "type": proposal.type, "amount": proposal.amount}
