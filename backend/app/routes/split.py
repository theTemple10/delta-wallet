from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.models import InflowEvent, Channel, Proposal, ProposalType
from app.services.groq_service import generate_split_proposal

router = APIRouter()


class SplitRequest(BaseModel):
    mode: str = "ai"
    splits: Optional[List[dict]] = None


@router.post("/inflow/{inflow_event_id}/propose-split")
async def propose_split(inflow_event_id: str, request: SplitRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InflowEvent).where(InflowEvent.id == inflow_event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Inflow event not found")

    channels_result = await db.execute(select(Channel).where(Channel.user_id == event.user_id))
    channels = channels_result.scalars().all()

    if request.mode == "ai" and not request.splits:
        splits = await generate_split_proposal(event.amount, event.currency, [{"id": str(c.id), "label": c.label, "type": c.type, "target_currency": c.target_currency} for c in channels])
    else:
        splits = request.splits or []

    for split in splits:
        proposal = Proposal(
            inflow_event_id=event.id,
            channel_id=split["channel_id"],
            type=ProposalType.SWAP if "USD" in event.currency else ProposalType.TRANSFER,
            amount=split["amount"],
            status="DRAFT"
        )
        db.add(proposal)

    await db.commit()
    return {"splits": splits, "inflow_event_id": str(event.id)}
