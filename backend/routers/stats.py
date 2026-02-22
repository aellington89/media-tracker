from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    return crud.get_overview_stats(db)


@router.get("/recent")
def get_recent(db: Session = Depends(get_db)):
    return crud.get_recent_completed(db, limit=10)
