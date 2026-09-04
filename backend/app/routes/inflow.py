from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import User, InflowEvent

router = APIRouter()


class InflowRequest(BaseModel):
    user_id: str
    amount: float
    currency: str = "USDB"


@router.post("")
async def simulate_inflow(request: InflowRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    event = InflowEvent(
        user_id=user.id,
        amount=request.amount,
        currency=request.currency
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return {"inflow_event_id": str(event.id), "amount": request.amount, "currency": request.currency}
