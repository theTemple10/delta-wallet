from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.routes import seed, inflow, channels, proposals, cards, digest, split

app = FastAPI(title="Delta Wallet API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(seed.router, prefix="/users", tags=["seed"])
app.include_router(inflow.router, prefix="/inflow", tags=["inflow"])
app.include_router(split.router, prefix="", tags=["split"])
app.include_router(channels.router, prefix="/channels", tags=["channels"])
app.include_router(proposals.router, prefix="/proposals", tags=["proposals"])
app.include_router(cards.router, prefix="/cards", tags=["cards"])
app.include_router(digest.router, prefix="/digest", tags=["digest"])


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {"status": "ok"}
