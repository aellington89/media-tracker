from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String, default="folder")
    color = Column(String, default="#6366f1")
    is_system = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    media_items = relationship("MediaItem", back_populates="category")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    color = Column(String, default="#94a3b8")

    media_tags = relationship("MediaTag", back_populates="tag", cascade="all, delete-orphan")


class MediaTag(Base):
    __tablename__ = "media_tags"

    media_id = Column(Integer, ForeignKey("media_items.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    media_item = relationship("MediaItem", back_populates="media_tags")
    tag = relationship("Tag", back_populates="media_tags")


class MediaItem(Base):
    __tablename__ = "media_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    status = Column(String, nullable=False, default="wishlist")
    rating = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    cover_image_url = Column(String, nullable=True)
    date_started = Column(String, nullable=True)
    date_finished = Column(String, nullable=True)
    metadata_json = Column("metadata", Text, nullable=True, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="media_items")
    media_tags = relationship("MediaTag", back_populates="media_item", cascade="all, delete-orphan")


class FieldValue(Base):
    __tablename__ = "field_values"

    id = Column(Integer, primary_key=True, autoincrement=True)
    field_type = Column(String, nullable=False)
    # NULL category_id = shared / global list (author, platform, etc.)
    # Non-NULL = scoped to that category (genre, sub_genre)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    value = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("field_type", "category_id", "value", name="uq_field_value"),
    )
