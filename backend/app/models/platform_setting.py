"""Platform settings key-value model."""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now_naive():
    """Return current UTC datetime without timezone for DB compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PlatformSetting(Base):
    """Persisted platform configuration stored as JSON values by key."""

    __tablename__ = "platform_settings"

    key = Column(String(100), primary_key=True, index=True)
    value: Any = Column(JSON, nullable=False)
    description = Column(String(255), nullable=True)
    updated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now_naive, server_default=text("NOW()"), nullable=False)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=True)

    updated_by = relationship("User")

    def __repr__(self):
        return f"<PlatformSetting(key={self.key})>"
