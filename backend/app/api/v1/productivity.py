"""
Delivery360 - API Endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.get("/")
async def list_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return {"message": "Endpoint en desarrollo", "data": []}


@router.post("/", status_code=201)
async def create_item(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return {"message": "Creación en desarrollo"}


@router.get("/{item_id}")
async def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return {"message": f"Item {item_id} en desarrollo"}


@router.put("/{item_id}")
async def update_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return {"message": "Actualización en desarrollo"}


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return None
