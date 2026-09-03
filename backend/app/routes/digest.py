from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import InflowEvent, Proposal, Digest, DigestMode
from app.services.groq_service import generate_split_proposal, generate_digest

router = APIRouter()


@router.get("/digest/{inflow_event_id}")
async def get_digest(inflow_event_id: str, mode: str = "ai", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InflowEvent).where(InflowEvent.id == inflow_event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Inflow event not found")

    proposals_result = await db.execute(select(Proposal).where(Proposal.inflow_event_id == inflow_event_id))
    proposals = proposals_result.scalars().all()

    if mode == "ai":
        content = await generate_digest(event, proposals)
        digest_mode = DigestMode.AI
    else:
        content = f"Inflow: {event.amount} {event.currency}. Proposals: {len(proposals)} created."
        digest_mode = DigestMode.STATS

    digest = Digest(user_id=event.user_id, inflow_event_id=event.id, content=content, mode=digest_mode)
    db.add(digest)
    await db.commit()

    return {"digest": content, "mode": mode}
