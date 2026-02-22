from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ── Categories ──────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1)
    icon: str = "📁"
    color: str = "#6366f1"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryRead(BaseModel):
    id: int
    name: str
    icon: str
    color: str
    is_system: int
    # Computed at query time (COUNT of media_items), not stored in the DB.
    # Defaults to 0 so Pydantic has a valid value when constructing from a dict.
    item_count: int = 0

    # Allows Pydantic to read field values directly from SQLAlchemy ORM objects
    # (e.g. category.name) instead of requiring a plain dict.
    model_config = {"from_attributes": True}


# ── Tags ─────────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1)
    color: str = "#94a3b8"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagRead(BaseModel):
    id: int
    name: str
    color: str
    # How many media items currently use this tag; computed at query time.
    usage_count: int = 0

    model_config = {"from_attributes": True}


# ── Media Items ──────────────────────────────────────────────────────────────

class MediaItemCreate(BaseModel):
    title: str = Field(..., min_length=1)
    category_id: int
    status: str = "wishlist"
    rating: Optional[str] = None
    notes: Optional[str] = None
    cover_image_url: Optional[str] = None
    metadata: Optional[dict] = {}
    tag_ids: list[int] = []


class MediaItemUpdate(BaseModel):
    title: Optional[str] = None
    category_id: Optional[int] = None
    status: Optional[str] = None
    rating: Optional[str] = None
    notes: Optional[str] = None
    cover_image_url: Optional[str] = None
    metadata: Optional[dict] = None
    tag_ids: Optional[list[int]] = None


class TagSimple(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class MediaItemRead(BaseModel):
    id: int
    title: str
    category_id: int
    category_name: str
    category_color: str
    category_icon: str
    status: str
    rating: Optional[str]
    notes: Optional[str]
    cover_image_url: Optional[str]
    metadata: dict
    tags: list[TagSimple]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedMedia(BaseModel):
    items: list[MediaItemRead]
    total: int
    limit: int
    offset: int


# ── Field Values (user-defined pick-lists) ────────────────────────────────────

class FieldValueCreate(BaseModel):
    field_type: str = Field(..., min_length=1)
    category_id: Optional[int] = None
    value: str = Field(..., min_length=1)
    sort_order: int = 0


class FieldValueUpdate(BaseModel):
    value: Optional[str] = None
    sort_order: Optional[int] = None


class FieldValueRead(BaseModel):
    id: int
    field_type: str
    category_id: Optional[int]
    value: str
    sort_order: int

    model_config = {"from_attributes": True}
