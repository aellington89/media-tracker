from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import TagCreate, TagUpdate
from .. import crud

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    return crud.list_tags(db)


@router.post("", status_code=201)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    return crud.create_tag(db, data)


@router.put("/{tag_id}")
def update_tag(tag_id: int, data: TagUpdate, db: Session = Depends(get_db)):
    result = crud.update_tag(db, tag_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Tag not found")
    return result


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    if not crud.delete_tag(db, tag_id):
        raise HTTPException(status_code=404, detail="Tag not found")
