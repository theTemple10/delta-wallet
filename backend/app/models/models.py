import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, Float, DateTime, Date, ForeignKey, Text, Integer, Numeric, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class UserRole(str, enum.Enum):
    SELF = "self"
    RECIPIENT = "recipient"


class DemoPersona(str, enum.Enum):
    BUNCH_DILLON = "bunch_dillon"
    SAMSON_JABO = "samson_jabo"


class ChannelType(str, enum.Enum):
    SPEND = "spend"
    SAVE = "save"
    TRANSFER = "transfer"


class PeriodType(str, enum.Enum):
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    ONE_OFF = "one_off"


class ProposalType(str, enum.Enum):
    SWAP = "SWAP"
    TRANSFER = "TRANSFER"


class ProposalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVALS = "PENDING_APPROVALS"
    PENDING_SIGNATURES = "PENDING_SIGNATURES"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"


class DigestMode(str, enum.Enum):
    AI = "ai"
    STATS = "stats"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bmoni_user_id = Column(String, nullable=True)
    smart_wallet_id = Column(String, nullable=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    bvn = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.SELF)
    demo_persona = Column(SAEnum(DemoPersona), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    channels = relationship("Channel", back_populates="user", foreign_keys="[Channel.user_id]")
    inflow_events = relationship("InflowEvent", back_populates="user")


class Channel(Base):
    __tablename__ = "channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    label = Column(String, nullable=False)
    type = Column(SAEnum(ChannelType), nullable=False)
    target_currency = Column(String, nullable=False)
    recipient_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Priority-aware funding fields
    target_amount = Column(Numeric(12, 2), nullable=True)
    period = Column(SAEnum(PeriodType), nullable=False, default=PeriodType.MONTHLY)
    priority_rank = Column(Integer, nullable=False, default=100)
    funded_amount = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    period_start = Column(Date, nullable=True, default=date.today)

    user = relationship("User", back_populates="channels", foreign_keys=[user_id])
    proposals = relationship("Proposal", back_populates="channel")


class InflowEvent(Base):
    __tablename__ = "inflow_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="completed")

    user = relationship("User", back_populates="inflow_events")
    proposals = relationship("Proposal", back_populates="inflow_event")
    digests = relationship("Digest", back_populates="inflow_event")


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inflow_event_id = Column(UUID(as_uuid=True), ForeignKey("inflow_events.id"), nullable=False)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("channels.id"), nullable=False)
    bmoni_proposal_id = Column(String, nullable=True)
    type = Column(SAEnum(ProposalType), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SAEnum(ProposalStatus), default=ProposalStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inflow_event = relationship("InflowEvent", back_populates="proposals")
    channel = relationship("Channel", back_populates="proposals")


class Card(Base):
    __tablename__ = "cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    bmoni_card_id = Column(String, nullable=True)
    currency = Column(String, nullable=False)
    daily_limit = Column(Float, nullable=True)
    single_txn_limit = Column(Float, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)


class Digest(Base):
    __tablename__ = "digests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    inflow_event_id = Column(UUID(as_uuid=True), ForeignKey("inflow_events.id"), nullable=False)
    content = Column(Text, nullable=False)
    mode = Column(SAEnum(DigestMode), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    inflow_event = relationship("InflowEvent", back_populates="digests")
