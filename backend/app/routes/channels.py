from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Channel, User, ChannelType, PeriodType, Proposal, ProposalStatus

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
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None


class ChannelUpdate(BaseModel):
    label: Optional[str] = None
    type: Optional[ChannelType] = None
    target_currency: Optional[str] = None
    target_amount: Optional[float] = None
    period: Optional[str] = None
    priority_rank: Optional[int] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None


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
        "bank_name": c.bank_name,
        "account_number": c.account_number,
        "account_name": c.account_name,
        "mature": c.target_amount is not None and funded >= c.target_amount if c.target_amount else False,
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
        bank_name=request.bank_name,
        account_number=request.account_number,
        account_name=request.account_name,
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


@router.put("/{channel_id}")
async def update_channel(channel_id: str, request: ChannelUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if request.label is not None:
        channel.label = request.label
    if request.type is not None:
        channel.type = request.type
    if request.target_currency is not None:
        channel.target_currency = request.target_currency
    if request.target_amount is not None:
        channel.target_amount = Decimal(str(request.target_amount)) if request.target_amount else None
    if request.period is not None:
        channel.period = PeriodType(request.period)
    if request.priority_rank is not None:
        channel.priority_rank = request.priority_rank
    if request.bank_name is not None:
        channel.bank_name = request.bank_name
    if request.account_number is not None:
        channel.account_number = request.account_number
    if request.account_name is not None:
        channel.account_name = request.account_name

    await db.commit()
    await db.refresh(channel)
    return _channel_to_dict(channel)


@router.delete("/{channel_id}")
async def delete_channel(channel_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    await db.delete(channel)
    await db.commit()
    return {"message": "Channel deleted", "channel_id": channel_id}


class AccountDetailsUpdate(BaseModel):
    bank_name: str
    account_number: str
    account_name: str


@router.put("/{channel_id}/account")
async def update_account_details(channel_id: str, request: AccountDetailsUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    channel.bank_name = request.bank_name
    channel.account_number = request.account_number
    channel.account_name = request.account_name
    await db.commit()
    await db.refresh(channel)
    return _channel_to_dict(channel)


@router.post("/{channel_id}/payout")
async def simulate_payout(channel_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    if not channel.target_amount:
        raise HTTPException(status_code=400, detail="Channel has no target amount")
    funded = channel.funded_amount or Decimal("0")
    if funded < channel.target_amount:
        raise HTTPException(status_code=400, detail=f"Channel not yet mature. Funded: {funded}, Target: {channel.target_amount}")

    payout_amount = float(channel.funded_amount)

    # Reset the channel for next period
    channel.funded_amount = Decimal("0")
    channel.period_start = date.today()
    await db.commit()

    return {
        "channel_id": str(channel.id),
        "label": channel.label,
        "type": channel.type.value if hasattr(channel.type, 'value') else channel.type,
        "payout_amount": payout_amount,
        "currency": channel.target_currency,
        "bank_name": channel.bank_name,
        "account_number": channel.account_number,
        "account_name": channel.account_name,
        "status": "payout_simulated",
    }
