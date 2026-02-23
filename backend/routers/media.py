from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db, UPLOADS_DIR
from ..schemas import MediaItemCreate, MediaItemUpdate, PaginatedMedia
from .. import crud


def _delete_upload_file(url: str | None) -> None:
    """Delete a cover image from UPLOADS_DIR if it is a local upload.

    Only paths starting with /uploads/ are considered local; external URLs
    (http/https) are ignored. Errors are suppressed so a missing or
    already-deleted file never causes the request to fail.
    """
    if not url or not url.startswith("/uploads/"):
        return
    filename = url.removeprefix("/uploads/")
    path = UPLOADS_DIR / filename
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass

router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=PaginatedMedia)
def list_media(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    status: Optional[str] = None,
    # Query(None) is required here (not a plain default) so that an explicit
    # empty-string value rating="" can be used to filter for unrated items.
    # Without Query(), FastAPI treats "" the same as None (parameter absent).
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
    old = crud.get_media_item(db, item_id)
    if not old:
        raise HTTPException(status_code=404, detail="Media item not found")
    old_url = old.get("cover_image_url")
    item = crud.update_media_item(db, item_id, data)
    # Delete the old image only when it has been replaced with a different one.
    if old_url and old_url != item.get("cover_image_url"):
        _delete_upload_file(old_url)
    return item


# 204 No Content is the REST convention for a successful DELETE — the resource
# is gone and there is nothing to return in the response body.
@router.delete("/{item_id}", status_code=204)
def delete_media(item_id: int, db: Session = Depends(get_db)):
    item = crud.get_media_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    cover_url = item.get("cover_image_url")
    crud.delete_media_item(db, item_id)
    _delete_upload_file(cover_url)


@router.post("/{item_id}/tags")
def set_tags(item_id: int, tag_ids: list[int], db: Session = Depends(get_db)):
    item = crud.set_media_tags(db, item_id, tag_ids)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return item
