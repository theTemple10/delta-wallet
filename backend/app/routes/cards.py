from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import Card, User
from app.services.bmoni_client import bmoni_client

router = APIRouter()


class CardCreate(BaseModel):
    user_id: str
    card_name: str = "Delta Spend"
    card_color: str = "#4285F4"
    currency: str = "NGN"
    card_type: str = "virtual"
    smart_wallet_id: str = "default-wallet"
    nin: str = "63184876213"


class CardLimitUpdate(BaseModel):
    daily_limit: float
    single_txn_limit: float


@router.post("/cards")
async def issue_card(request: CardCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    wallet_id = user.smart_wallet_id or request.smart_wallet_id

    response = await bmoni_client.issue_card(user.bmoni_user_id, {
        "cardName": request.card_name, "cardColor": request.card_color,
        "currency": request.currency, "type": request.card_type,
        "smartWalletId": wallet_id, "nin": request.nin
    })

    card = Card(user_id=user.id, bmoni_card_id=response.get("data", {}).get("card", {}).get("id"), currency=request.currency)
    db.add(card)
    await db.commit()
    await db.refresh(card)

    return {"card_id": str(card.id), "status": card.status}


@router.put("/cards/{card_id}/limit")
async def set_card_limit(card_id: str, request: CardLimitUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    user_result = await db.execute(select(User).where(User.id == card.user_id))
    user = user_result.scalar_one_or_none()

    await bmoni_client.set_card_limit(user.bmoni_user_id, card.bmoni_card_id, {
        "totalDailyLimit": request.daily_limit, "maxSingleTransactionAmount": request.single_txn_limit
    })

    card.daily_limit = request.daily_limit
    card.single_txn_limit = request.single_txn_limit
    await db.commit()

    return {"card_id": str(card.id), "daily_limit": card.daily_limit, "single_txn_limit": card.single_txn_limit}
