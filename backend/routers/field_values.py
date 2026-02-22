from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import FieldValueCreate, FieldValueUpdate, FieldValueRead
from .. import crud

router = APIRouter(prefix="/field-values", tags=["field-values"])


@router.get("", response_model=list[FieldValueRead])
def get_field_values(
    field_type: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    scoped: bool = Query(False, description="If true, filter strictly by category_id (including NULL)"),
    db: Session = Depends(get_db),
):
    """
    Return field values.
    - No params → all values (for Settings page)
    - field_type + scoped=true + category_id → values for a specific field/category combo
    - field_type only → all values for that field_type across all categories
    """
    return crud.list_field_values(
        db,
        field_type=field_type,
        category_id=category_id,
        category_id_filter=scoped,
    )


@router.post("", response_model=FieldValueRead, status_code=201)
def create_field_value(data: FieldValueCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_field_value(db, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{fv_id}", response_model=FieldValueRead)
def update_field_value(fv_id: int, data: FieldValueUpdate, db: Session = Depends(get_db)):
    result = crud.update_field_value(db, fv_id, data)
    if result is None:
        raise HTTPException(status_code=404, detail="Field value not found")
    return result


@router.delete("/{fv_id}", status_code=204)
def delete_field_value(fv_id: int, db: Session = Depends(get_db)):
    if not crud.delete_field_value(db, fv_id):
        raise HTTPException(status_code=404, detail="Field value not found")
