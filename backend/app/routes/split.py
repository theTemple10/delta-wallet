from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.models import InflowEvent, Channel, Proposal, ProposalType, ChannelType, PeriodType
from app.services.groq_service import generate_split_proposal

router = APIRouter()


class SplitRequest(BaseModel):
    mode: str = "ai"
    splits: Optional[List[dict]] = None


def _period_length_days(period: PeriodType) -> int:
    if period == PeriodType.WEEKLY:
        return 7
    if PeriodType.ONE_OFF:
        return 365000  # effectively never resets
    return 30  # monthly


def _is_period_expired(channel: Channel) -> bool:
    if not channel.period_start:
        return True
    today = date.today()
    elapsed = (today - channel.period_start).days
    return elapsed >= _period_length_days(channel.period or PeriodType.MONTHLY)


def _reset_period(channel: Channel) -> None:
    channel.funded_amount = Decimal("0")
    channel.period_start = date.today()


def _waterfall_allocations(amount: Decimal, channels: List[Channel]) -> list:
    """
    Priority waterfall allocation.
    Sorted by priority_rank ascending (lower = funded first).
    Each channel gets up to (target_amount - funded_amount).
    Channels with no target_amount are discretionary (get the remainder).
    """
    sorted_chs = sorted(channels, key=lambda c: c.priority_rank or 100)
    remaining = amount
    allocations = []

    for ch in sorted_chs:
        # Check / reset period if expired
        if _is_period_expired(ch):
            _reset_period(ch)

        target = ch.target_amount
        funded = ch.funded_amount or Decimal("0")

        if target is None:
            # Discretionary channel — gets whatever is left
            allocation = remaining
        else:
            shortfall = max(target - funded, Decimal("0"))
            allocation = min(shortfall, remaining)

        allocations.append({
            "channel_id": str(ch.id),
            "amount": float(allocation),
            "one_line_reason": "",
            "label": ch.label,
            "type": ch.type.value if hasattr(ch.type, 'value') else ch.type,
            "target_currency": ch.target_currency,
            "target_amount": float(target) if target else None,
            "funded_amount": float(funded),
            "shortfall": float(max((target or Decimal("0")) - funded, Decimal("0"))),
        })

        remaining -= allocation
        if remaining <= Decimal("0"):
            break

    # If there's leftover after all channels funded, add it to discretionary
    if remaining > Decimal("0"):
        for a in allocations:
            if a["target_amount"] is None:
                a["amount"] += float(remaining)
                break

    return allocations


@router.post("/inflow/{inflow_event_id}/propose-split")
async def propose_split(inflow_event_id: str, request: SplitRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InflowEvent).where(InflowEvent.id == inflow_event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Inflow event not found")

    channels_result = await db.execute(
        select(Channel).where(Channel.user_id == event.user_id).order_by(Channel.priority_rank)
    )
    channels = list(channels_result.scalars().all())

    if request.mode == "ai" and not request.splits:
        # Waterfall allocation (deterministic)
        allocations = _waterfall_allocations(Decimal(str(event.amount)), channels)

        # Get AI reasons for each allocation
        channels_with_allocations = [
            {"id": a["channel_id"], "label": a["label"], "type": a["type"], "target_currency": a["target_currency"]}
            for a in allocations if a["amount"] > 0
        ]

        if channels_with_allocations:
            ai_reasons = await generate_split_proposal(
                event.amount, event.currency, channels_with_allocations
            )
            # Merge AI reasons into allocations
            reason_map = {r.get("channel_id", ""): r.get("one_line_reason", "Funded") for r in ai_reasons}
            for a in allocations:
                if a["amount"] > 0:
                    a["one_line_reason"] = reason_map.get(a["channel_id"], "Funded by priority")
                else:
                    shortfall_reason = "Needs \u20A6{:.0f} more this period".format(a["shortfall"]) if a["shortfall"] > 0 else "Fully funded"
                    a["one_line_reason"] = shortfall_reason
        else:
            for a in allocations:
                a["one_line_reason"] = "Fully funded" if a["amount"] == 0 and a["shortfall"] == 0 else "Priority allocation"

        splits = allocations
    elif request.mode == "manual" and request.splits:
        splits = request.splits
    else:
        splits = []

    for split in splits:
        if split.get("amount", 0) > 0:
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
