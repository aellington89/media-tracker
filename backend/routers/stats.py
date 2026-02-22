from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    # Also used as the health-check endpoint by run.py's wait_for_server().
    return crud.get_overview_stats(db)


@router.get("/recent")
def get_recent(db: Session = Depends(get_db)):
    # Returns the 10 most recently updated "owned" items for the dashboard carousel.
    return crud.get_recent_completed(db, limit=10)
