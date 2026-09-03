from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.models import User, Channel, UserRole, DemoPersona, ChannelType
from app.services.bmoni_client import bmoni_client

router = APIRouter()

DEMO_USERS = [
    {
        "first_name": "Bunch", "last_name": "Dillon",
        "phone": "+2348000000000", "bvn": "95888168924",
        "role": UserRole.SELF, "persona": DemoPersona.BUNCH_DILLON,
        "email": "bunch.dillon@example.com"
    },
    {
        "first_name": "Samson", "last_name": "Jabo",
        "phone": "+2348000000001", "bvn": "22222222222",
        "role": UserRole.RECIPIENT, "persona": DemoPersona.SAMSON_JABO,
        "email": "samson.jabo@example.com"
    }
]

DEMO_CHANNELS = [
    {"label": "NGN Spend", "type": ChannelType.SPEND, "target_currency": "CNGN"},
    {"label": "USD Savings", "type": ChannelType.SAVE, "target_currency": "USDB"},
    {"label": "Family — Samson", "type": ChannelType.TRANSFER, "target_currency": "CNGN"}
]


@router.post("/seed")
async def seed_demo_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).limit(1))
    if result.scalar_one_or_none():
        return {"message": "Demo users already seeded"}

    created_users = []
    for user_data in DEMO_USERS:
        bmoni_response = await bmoni_client.create_user(
            user_data["first_name"], user_data["last_name"],
            user_data["email"], user_data["phone"], user_data["bvn"]
        )
        bmoni_user_id = bmoni_response.get("data", {}).get("user", {}).get("id")

        user = User(
            bmoni_user_id=bmoni_user_id,
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            phone=user_data["phone"],
            bvn=user_data["bvn"],
            role=user_data["role"],
            demo_persona=user_data["persona"]
        )
        db.add(user)
        await db.flush()
        created_users.append(user)

    bunch = created_users[0]
    samson = created_users[1]

    for ch_data in DEMO_CHANNELS:
        channel = Channel(
            user_id=bunch.id,
            label=ch_data["label"],
            type=ch_data["type"],
            target_currency=ch_data["target_currency"],
            recipient_user_id=samson.id if ch_data["type"] == ChannelType.TRANSFER else None
        )
        db.add(channel)

    await db.commit()
    return {"message": "Demo users and channels seeded", "users": [{"id": str(u.id), "name": f"{u.first_name} {u.last_name}"} for u in created_users]}
