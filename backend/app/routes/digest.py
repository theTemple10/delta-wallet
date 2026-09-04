from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import InflowEvent, Proposal, Channel, Digest, DigestMode
from app.services.groq_service import generate_split_proposal, generate_digest

router = APIRouter()


@router.get("/{inflow_event_id}")
async def get_digest(inflow_event_id: str, mode: str = "ai", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InflowEvent).where(InflowEvent.id == inflow_event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Inflow event not found")

    proposals_result = await db.execute(select(Proposal).where(Proposal.inflow_event_id == inflow_event_id))
    proposals = proposals_result.scalars().all()

    # Build enriched proposal data
    proposal_details = []
    total_deducted = 0
    for p in proposals:
        ch_result = await db.execute(select(Channel).where(Channel.id == p.channel_id))
        ch = ch_result.scalar_one_or_none()
        proposal_details.append({
            "id": str(p.id),
            "channel_label": ch.label if ch else "Unknown",
            "channel_type": ch.type.value if ch and hasattr(ch.type, 'value') else (ch.type if ch else "unknown"),
            "type": p.type.value if hasattr(p.type, 'value') else p.type,
            "amount": p.amount,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "bank_name": ch.bank_name if ch else None,
            "account_number": ch.account_number if ch else None,
            "account_name": ch.account_name if ch else None,
        })
        if p.status and (p.status.value if hasattr(p.status, 'value') else p.status) == "COMPLETED":
            total_deducted += p.amount

    remaining_balance = event.amount - total_deducted

    if mode == "ai":
        content = await generate_digest(event, proposals)
        digest_mode = DigestMode.AI
    else:
        lines = [
            f"Inflow: {event.amount} {event.currency}",
            f"Total deducted: {total_deducted:.2f}",
            f"Remaining: {remaining_balance:.2f}",
            "",
            "Proposals:",
        ]
        for pd in proposal_details:
            lines.append(f"  {pd['channel_label']} ({pd['channel_type']}) - {pd['amount']:.2f} [{pd['status']}]")
            if pd['account_name']:
                lines.append(f"    -> {pd['account_name']} at {pd['bank_name']} ({pd['account_number']})")
        content = "\n".join(lines)
        digest_mode = DigestMode.STATS

    digest = Digest(user_id=event.user_id, inflow_event_id=event.id, content=content, mode=digest_mode)
    db.add(digest)
    await db.commit()

    return {
        "digest": content,
        "mode": mode,
        "inflow_amount": event.amount,
        "inflow_currency": event.currency,
        "total_deducted": total_deducted,
        "remaining_balance": remaining_balance,
        "proposals": proposal_details,
    }
