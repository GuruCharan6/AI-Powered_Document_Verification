from fastapi import APIRouter
from app.api import auth, documents, dashboard

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])