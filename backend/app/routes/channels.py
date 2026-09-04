from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Channel, User, ChannelType, PeriodType

router = APIRouter()


class ChannelCreate(BaseModel):
    user_id: str
    label: str
    type: ChannelType
    target_currency: str
    recipient_user_id: Optional[str] = None
    target_amount: Optional[float] = None
    period: Optional[str] = "monthly"
    priority_rank: Optional[int] = 100


def _period_length_days(period: PeriodType) -> int:
    if period == PeriodType.WEEKLY:
        return 7
    if period == PeriodType.ONE_OFF:
        return 365000
    return 30


def _is_period_expired(channel: Channel) -> bool:
    if not channel.period_start:
        return True
    today = date.today()
    elapsed = (today - channel.period_start).days
    return elapsed >= _period_length_days(channel.period or PeriodType.MONTHLY)


def _channel_to_dict(c: Channel) -> dict:
    """Convert channel to dict with period rollover check."""
    funded = c.funded_amount or Decimal("0")
    if _is_period_expired(c):
        funded = Decimal("0")
    return {
        "id": str(c.id),
        "label": c.label,
        "type": c.type.value if hasattr(c.type, 'value') else c.type,
        "target_currency": c.target_currency,
        "target_amount": float(c.target_amount) if c.target_amount else None,
        "period": c.period.value if hasattr(c.period, 'value') else c.period,
        "priority_rank": c.priority_rank,
        "funded_amount": float(funded),
    }


@router.post("")
async def create_channel(request: ChannelCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == request.user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    channel = Channel(
        user_id=request.user_id,
        label=request.label,
        type=request.type,
        target_currency=request.target_currency,
        recipient_user_id=request.recipient_user_id,
        target_amount=Decimal(str(request.target_amount)) if request.target_amount else None,
        period=PeriodType(request.period) if request.period else PeriodType.MONTHLY,
        priority_rank=request.priority_rank or 100,
        funded_amount=Decimal("0"),
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"channel_id": str(channel.id), "label": channel.label}


@router.get("/{user_id}")
async def get_user_channels(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Channel).where(Channel.user_id == user_id).order_by(Channel.priority_rank)
    )
    channels = result.scalars().all()
    return [_channel_to_dict(c) for c in channels]
