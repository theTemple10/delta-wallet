from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import User
from app.services.bmoni_client import bmoni_client

router = APIRouter()


@router.get("/balance/{user_id}")
async def get_balance(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.smart_wallet_id:
        raise HTTPException(status_code=400, detail="No wallet found for user")

    try:
        response = await bmoni_client.get_balance(user.bmoni_user_id, user.smart_wallet_id)
        return response.get("data", {"balances": []})
    except Exception:
        return {"balances": [
            {"currency": "USDB", "amount": "0.00"},
            {"currency": "CNGN", "amount": "0.00"}
        ]}
