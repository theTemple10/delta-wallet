from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Channel, User, ChannelType

router = APIRouter()


class ChannelCreate(BaseModel):
    user_id: str
    label: str
    type: ChannelType
    target_currency: str
    recipient_user_id: Optional[str] = None


@router.post("/channels")
async def create_channel(request: ChannelCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == request.user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    channel = Channel(
        user_id=request.user_id,
        label=request.label,
        type=request.type,
        target_currency=request.target_currency,
        recipient_user_id=request.recipient_user_id
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"channel_id": str(channel.id), "label": channel.label}


@router.get("/channels/{user_id}")
async def get_user_channels(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.user_id == user_id))
    channels = result.scalars().all()
    return [{"id": str(c.id), "label": c.label, "type": c.type, "target_currency": c.target_currency} for c in channels]
