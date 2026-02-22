import json
from datetime import datetime
from typing import Optional
from sqlalchemy import func, and_, text
from sqlalchemy.orm import Session, joinedload

from .models import MediaItem, Category, Tag, MediaTag, FieldValue
from .schemas import (
    MediaItemCreate, MediaItemUpdate,
    CategoryCreate, CategoryUpdate,
    TagCreate, TagUpdate,
    FieldValueCreate, FieldValueUpdate,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_item(item: MediaItem) -> dict:
    tags = [{"id": mt.tag.id, "name": mt.tag.name, "color": mt.tag.color}
            for mt in item.media_tags if mt.tag]
    try:
        metadata = json.loads(item.metadata_json or "{}")
    except Exception:
        metadata = {}
    return {
        "id": item.id,
        "title": item.title,
        "category_id": item.category_id,
        "category_name": item.category.name if item.category else "",
        "category_color": item.category.color if item.category else "#6366f1",
        "category_icon": item.category.icon if item.category else "📁",
        "status": item.status,
        "rating": item.rating,
        "notes": item.notes,
        "cover_image_url": item.cover_image_url,
        "metadata": metadata,
        "tags": tags,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _load_item(db: Session, item_id: int) -> Optional[MediaItem]:
    return (
        db.query(MediaItem)
        .options(
            joinedload(MediaItem.category),
            joinedload(MediaItem.media_tags).joinedload(MediaTag.tag),
        )
        .filter(MediaItem.id == item_id)
        .first()
    )


# ── Media CRUD ────────────────────────────────────────────────────────────────

def get_media_items(
    db: Session,
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    status: Optional[str] = None,
    rating: Optional[str] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    tag_ids: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    query = (
        db.query(MediaItem)
        .options(
            joinedload(MediaItem.category),
            joinedload(MediaItem.media_tags).joinedload(MediaTag.tag),
        )
    )

    if q:
        like = f"%{q}%"
        query = query.filter(
            (MediaItem.title.ilike(like)) | (MediaItem.notes.ilike(like))
        )
    if category_id:
        query = query.filter(MediaItem.category_id == category_id)
    if status:
        query = query.filter(MediaItem.status == status)
    if rating is not None:
        query = query.filter(MediaItem.rating == rating)

    # Tag AND-filter: item must have ALL requested tags
    if tag_ids:
        ids = [int(x) for x in tag_ids.split(",") if x.strip()]
        for tid in ids:
            sub = db.query(MediaTag.media_id).filter(MediaTag.tag_id == tid).subquery()
            query = query.filter(MediaItem.id.in_(sub))

    total = query.count()

    # Sorting
    valid_sort = {"title", "created_at", "date_finished", "date_started", "rating", "status"}
    col = sort_by if sort_by in valid_sort else "created_at"
    order_col = getattr(MediaItem, col)
    if sort_dir == "asc":
        query = query.order_by(order_col.asc().nullslast())
    else:
        query = query.order_by(order_col.desc().nullslast())

    items = query.offset(offset).limit(limit).all()
    return [_serialize_item(i) for i in items], total


def get_media_item(db: Session, item_id: int) -> Optional[dict]:
    item = _load_item(db, item_id)
    return _serialize_item(item) if item else None


def create_media_item(db: Session, data: MediaItemCreate) -> dict:
    tag_ids = data.tag_ids or []
    item = MediaItem(
        title=data.title,
        category_id=data.category_id,
        status=data.status,
        rating=data.rating,
        notes=data.notes,
        cover_image_url=data.cover_image_url,
        metadata_json=json.dumps(data.metadata or {}),
    )
    db.add(item)
    db.flush()
    _set_tags(db, item.id, tag_ids)
    db.commit()
    return get_media_item(db, item.id)


def update_media_item(db: Session, item_id: int, data: MediaItemUpdate) -> Optional[dict]:
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        return None

    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)
    metadata = update_data.pop("metadata", None)

    for field, value in update_data.items():
        setattr(item, field, value)

    if metadata is not None:
        item.metadata_json = json.dumps(metadata)

    item.updated_at = datetime.utcnow()

    if tag_ids is not None:
        _set_tags(db, item_id, tag_ids)

    db.commit()
    return get_media_item(db, item_id)


def delete_media_item(db: Session, item_id: int) -> bool:
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True


def _set_tags(db: Session, item_id: int, tag_ids: list[int]):
    db.query(MediaTag).filter(MediaTag.media_id == item_id).delete()
    for tid in tag_ids:
        db.add(MediaTag(media_id=item_id, tag_id=tid))


def set_media_tags(db: Session, item_id: int, tag_ids: list[int]) -> Optional[dict]:
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        return None
    _set_tags(db, item_id, tag_ids)
    db.commit()
    return get_media_item(db, item_id)


# ── Category CRUD ─────────────────────────────────────────────────────────────

def list_categories(db: Session) -> list[dict]:
    cats = db.query(Category).all()
    result = []
    for c in cats:
        count = db.query(func.count(MediaItem.id)).filter(
            MediaItem.category_id == c.id
        ).scalar()
        result.append({
            "id": c.id,
            "name": c.name,
            "icon": c.icon,
            "color": c.color,
            "is_system": c.is_system,
            "item_count": count,
        })
    return result


def create_category(db: Session, data: CategoryCreate) -> dict:
    cat = Category(name=data.name, icon=data.icon, color=data.color, is_system=0)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "icon": cat.icon, "color": cat.color,
            "is_system": cat.is_system, "item_count": 0}


def update_category(db: Session, cat_id: int, data: CategoryUpdate) -> Optional[dict]:
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        return None
    if data.name is not None:
        cat.name = data.name
    if data.icon is not None:
        cat.icon = data.icon
    if data.color is not None:
        cat.color = data.color
    db.commit()
    count = db.query(func.count(MediaItem.id)).filter(
        MediaItem.category_id == cat.id
    ).scalar()
    return {"id": cat.id, "name": cat.name, "icon": cat.icon, "color": cat.color,
            "is_system": cat.is_system, "item_count": count}


def delete_category(db: Session, cat_id: int) -> tuple[bool, str]:
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        return False, "not_found"
    if cat.is_system:
        return False, "system"
    count = db.query(func.count(MediaItem.id)).filter(
        MediaItem.category_id == cat_id
    ).scalar()
    if count > 0:
        return False, "has_items"
    db.delete(cat)
    db.commit()
    return True, "ok"


# ── Tag CRUD ──────────────────────────────────────────────────────────────────

def list_tags(db: Session) -> list[dict]:
    tags = db.query(Tag).all()
    result = []
    for t in tags:
        count = db.query(func.count(MediaTag.media_id)).filter(
            MediaTag.tag_id == t.id
        ).scalar()
        result.append({"id": t.id, "name": t.name, "color": t.color, "usage_count": count})
    return result


def create_tag(db: Session, data: TagCreate) -> dict:
    tag = Tag(name=data.name, color=data.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color, "usage_count": 0}


def update_tag(db: Session, tag_id: int, data: TagUpdate) -> Optional[dict]:
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        return None
    if data.name is not None:
        tag.name = data.name
    if data.color is not None:
        tag.color = data.color
    db.commit()
    count = db.query(func.count(MediaTag.media_id)).filter(
        MediaTag.tag_id == tag_id
    ).scalar()
    return {"id": tag.id, "name": tag.name, "color": tag.color, "usage_count": count}


def delete_tag(db: Session, tag_id: int) -> bool:
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        return False
    db.delete(tag)
    db.commit()
    return True


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_overview_stats(db: Session) -> dict:
    total = db.query(func.count(MediaItem.id)).scalar()
    by_status = {}
    for s in ("wishlist", "owned"):
        by_status[s] = db.query(func.count(MediaItem.id)).filter(
            MediaItem.status == s
        ).scalar()

    avg = db.query(func.avg(MediaItem.rating)).filter(
        MediaItem.rating.isnot(None)
    ).scalar()
    avg_rating = round(float(avg), 1) if avg else 0.0

    cats = db.query(Category).all()
    by_category = []
    for c in cats:
        count = db.query(func.count(MediaItem.id)).filter(
            MediaItem.category_id == c.id
        ).scalar()
        by_category.append({"name": c.name, "color": c.color, "icon": c.icon, "count": count})

    grades = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"]
    rating_dist = {}
    for g in grades:
        rating_dist[g] = db.query(func.count(MediaItem.id)).filter(
            MediaItem.rating == g
        ).scalar()

    return {
        "total_items": total,
        "by_status": by_status,
        "avg_rating": avg_rating,
        "by_category": by_category,
        "rating_distribution": rating_dist,
    }


def get_recent_completed(db: Session, limit: int = 10) -> list[dict]:
    items = (
        db.query(MediaItem)
        .options(
            joinedload(MediaItem.category),
            joinedload(MediaItem.media_tags).joinedload(MediaTag.tag),
        )
        .filter(MediaItem.status == "owned")
        .order_by(MediaItem.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_item(i) for i in items]


# ── Field Value CRUD ──────────────────────────────────────────────────────────

def list_field_values(
    db: Session,
    field_type: Optional[str] = None,
    category_id: Optional[int] = None,
    category_id_filter: bool = False,
) -> list[dict]:
    query = db.query(FieldValue)
    if field_type:
        query = query.filter(FieldValue.field_type == field_type)
    if category_id_filter:
        query = query.filter(FieldValue.category_id == category_id)
    query = query.order_by(FieldValue.field_type, FieldValue.sort_order, FieldValue.value)
    return [
        {"id": fv.id, "field_type": fv.field_type, "category_id": fv.category_id,
         "value": fv.value, "sort_order": fv.sort_order}
        for fv in query.all()
    ]


def create_field_value(db: Session, data: FieldValueCreate) -> dict:
    fv = FieldValue(
        field_type=data.field_type,
        category_id=data.category_id,
        value=data.value,
        sort_order=data.sort_order,
    )
    db.add(fv)
    try:
        db.commit()
        db.refresh(fv)
    except Exception:
        db.rollback()
        raise
    return {"id": fv.id, "field_type": fv.field_type, "category_id": fv.category_id,
            "value": fv.value, "sort_order": fv.sort_order}


def update_field_value(db: Session, fv_id: int, data: FieldValueUpdate) -> Optional[dict]:
    fv = db.query(FieldValue).filter(FieldValue.id == fv_id).first()
    if not fv:
        return None
    if data.value is not None:
        fv.value = data.value
    if data.sort_order is not None:
        fv.sort_order = data.sort_order
    db.commit()
    return {"id": fv.id, "field_type": fv.field_type, "category_id": fv.category_id,
            "value": fv.value, "sort_order": fv.sort_order}


def delete_field_value(db: Session, fv_id: int) -> bool:
    fv = db.query(FieldValue).filter(FieldValue.id == fv_id).first()
    if not fv:
        return False
    db.delete(fv)
    db.commit()
    return True
