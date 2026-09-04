from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.models import Proposal, Channel, User, ProposalType, ProposalStatus
from app.services.bmoni_client import bmoni_client
from app.services.wallet import get_user_with_wallet
from app.services import proposal_signer

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

    user = await get_user_with_wallet(db, channel.user_id)
    wallet_id = user.smart_wallet_id

    to_bmoni_user_id = None
    if request.type == ProposalType.TRANSFER:
        if request.to_user_id:
            recipient_result = await db.execute(select(User).where(User.id == request.to_user_id))
            recipient = recipient_result.scalar_one_or_none()
            to_bmoni_user_id = recipient.bmoni_user_id if recipient else None
        elif channel.recipient_user_id:
            recipient_result = await db.execute(select(User).where(User.id == channel.recipient_user_id))
            recipient = recipient_result.scalar_one_or_none()
            to_bmoni_user_id = recipient.bmoni_user_id if recipient else None
        if not to_bmoni_user_id:
            raise HTTPException(status_code=400, detail="Transfer requires a resolved BMONI recipient")

    proposal_data = {}
    if request.type == ProposalType.TRANSFER:
        proposal_data = {"type": "TRANSFER", "toUserId": to_bmoni_user_id, "amount": str(request.amount), "currency": request.currency, "description": "Split transfer"}
    elif request.type == ProposalType.SWAP:
        proposal_data = {"type": "SWAP", "fromStablecoin": request.from_stablecoin, "toStablecoin": request.to_stablecoin, "fromAmount": str(request.amount), "slippageBps": 50}

    bmoni_response = await bmoni_client.create_proposal(user.bmoni_user_id, wallet_id, proposal_data)
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


@router.post("/{proposal_id}/approve")
async def approve_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    proposal = await proposal_signer.approve_proposal(db, proposal_id)
    return {"proposal_id": str(proposal.id), "status": proposal.status}


@router.get("/{proposal_id}/sign-payload")
async def get_sign_payload(proposal_id: str, db: AsyncSession = Depends(get_db)):
    hash_to_sign = await proposal_signer.get_sign_payload(db, proposal_id)
    return {"hash_to_sign": hash_to_sign}


@router.post("/{proposal_id}/sign")
async def sign_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    proposal = await proposal_signer.sign_proposal(db, proposal_id)
    return {"proposal_id": str(proposal.id), "status": proposal.status}


@router.get("/{proposal_id}")
async def get_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"id": str(proposal.id), "status": proposal.status, "type": proposal.type, "amount": proposal.amount}
