from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.models import User


async def get_user_with_wallet(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Fall back to a placeholder wallet in mock mode for users seeded before the
    # smart_wallet_id field existed. Live mode should always have a real wallet id.
    if not user.smart_wallet_id:
        user.smart_wallet_id = "default-wallet"
    return user
