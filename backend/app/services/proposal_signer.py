from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.models import Proposal, Channel, User, ProposalStatus
from app.services.bmoni_client import bmoni_client
from app.config import get_settings
from eth_account import Account


async def _load_user(db: AsyncSession, channel_id: str) -> User:
    channel_result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = channel_result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    user_result = await db.execute(select(User).where(User.id == channel.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def load_proposal(db: AsyncSession, proposal_id: str) -> Proposal:
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


async def approve_proposal(db: AsyncSession, proposal_id: str) -> Proposal:
    proposal = await load_proposal(db, proposal_id)
    user = await _load_user(db, proposal.channel_id)
    await bmoni_client.approve_proposal(user.bmoni_user_id, proposal.bmoni_proposal_id)
    proposal.status = ProposalStatus.PENDING_SIGNATURES
    await db.commit()
    await db.refresh(proposal)
    return proposal


async def get_sign_payload(db: AsyncSession, proposal_id: str) -> str:
    proposal = await load_proposal(db, proposal_id)
    user = await _load_user(db, proposal.channel_id)
    response = await bmoni_client.get_sign_payload(user.bmoni_user_id, proposal.bmoni_proposal_id)
    return response.get("data", {}).get("hashToSign")


async def sign_proposal(db: AsyncSession, proposal_id: str, poll: bool = True) -> Proposal:
    proposal = await load_proposal(db, proposal_id)
    user = await _load_user(db, proposal.channel_id)

    settings = get_settings()
    account = Account.from_key(settings.DEMO_WALLET_OWNER_PRIVATE_KEY)

    sign_response = await bmoni_client.get_sign_payload(user.bmoni_user_id, proposal.bmoni_proposal_id)
    hash_to_sign = sign_response.get("data", {}).get("hashToSign")
    if not hash_to_sign:
        raise HTTPException(status_code=400, detail="No hashToSign returned by BMONI sign-payload")

    signed = account.unsafe_sign_hash(hash_to_sign)
    signature = signed.signature.hex()

    await bmoni_client.sign_proposal(user.bmoni_user_id, proposal.bmoni_proposal_id, f"0x{signature}")

    if poll:
        status_response = await bmoni_client.get_proposal_status(user.bmoni_user_id, proposal.bmoni_proposal_id)
        remote_status = status_response.get("data", {}).get("proposal", {}).get("status", "")
        if remote_status == "COMPLETED":
            proposal.status = ProposalStatus.COMPLETED
        else:
            proposal.status = ProposalStatus.PENDING_SIGNATURES
    else:
        proposal.status = ProposalStatus.COMPLETED

    await db.commit()
    await db.refresh(proposal)
    return proposal
