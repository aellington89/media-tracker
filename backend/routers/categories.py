from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import CategoryCreate, CategoryUpdate
from .. import crud

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def list_categories(db: Session = Depends(get_db)):
    return crud.list_categories(db)


@router.post("", status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    return crud.create_category(db, data)


@router.put("/{cat_id}")
def update_category(cat_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    result = crud.update_category(db, cat_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    return result


# 204 No Content on success; 400 with a specific reason string for protected cases.
@router.delete("/{cat_id}", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    ok, reason = crud.delete_category(db, cat_id)
    if not ok:
        if reason == "not_found":
            raise HTTPException(status_code=404, detail="Category not found")
        elif reason == "system":
            # Built-in categories (Movies, TV Shows, etc.) cannot be removed.
            raise HTTPException(status_code=400, detail="Cannot delete built-in category")
        elif reason == "has_items":
            # Prevent deleting a category that still has media items in it.
            raise HTTPException(status_code=400, detail="Category has items — move or delete them first")
