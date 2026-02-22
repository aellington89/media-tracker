from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import MediaItemCreate, MediaItemUpdate, PaginatedMedia
from .. import crud

router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=PaginatedMedia)
def list_media(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    status: Optional[str] = None,
    rating: Optional[str] = Query(None),
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    tag_ids: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    items, total = crud.get_media_items(
        db, q=q, category_id=category_id, status=status,
        rating=rating,
        sort_by=sort_by, sort_dir=sort_dir,
        tag_ids=tag_ids, limit=limit, offset=offset,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{item_id}")
def get_media(item_id: int, db: Session = Depends(get_db)):
    item = crud.get_media_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return item


@router.post("", status_code=201)
def create_media(data: MediaItemCreate, db: Session = Depends(get_db)):
    return crud.create_media_item(db, data)


@router.put("/{item_id}")
def update_media(item_id: int, data: MediaItemUpdate, db: Session = Depends(get_db)):
    item = crud.update_media_item(db, item_id, data)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return item


@router.delete("/{item_id}", status_code=204)
def delete_media(item_id: int, db: Session = Depends(get_db)):
    if not crud.delete_media_item(db, item_id):
        raise HTTPException(status_code=404, detail="Media item not found")


@router.post("/{item_id}/tags")
def set_tags(item_id: int, tag_ids: list[int], db: Session = Depends(get_db)):
    item = crud.set_media_tags(db, item_id, tag_ids)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return item
