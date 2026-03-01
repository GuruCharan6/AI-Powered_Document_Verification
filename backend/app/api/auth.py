from fastapi import APIRouter, HTTPException, status
from fastapi import Depends
from datetime import timedelta
from app.models import UserSignup, UserLogin, Token, UserResponse
from app.auth import get_password_hash, verify_password, create_access_token, get_current_active_user
from app.config import settings
from app.database import get_supabase
from uuid import uuid4
from datetime import datetime

router = APIRouter()

@router.post("/signup", response_model=Token)
async def signup(user_data: UserSignup):
    supabase = get_supabase()
    
    # Check if user exists
    existing = supabase.table("users").select("id").eq("email", user_data.email).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    new_user = {
        "id": str(uuid4()),
        "email": user_data.email,
        "password_hash": hashed_password,
        "full_name": user_data.full_name,
        "department": user_data.department,
        "role": "operator",
        "is_active": True,
        "created_at": datetime.utcnow().isoformat()
    }
    
    response = supabase.table("users").insert(new_user).execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    created_user = response.data[0]
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(created_user["id"])}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        user=UserResponse(**created_user)
    )

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin):
    supabase = get_supabase()
    
    # Get user by email
    response = supabase.table("users").select("*").eq("email", login_data.email).single().execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    user = response.data
    
    # Verify password
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Update last login
    supabase.table("users").update({"last_login": datetime.utcnow().isoformat()}).eq("id", user["id"]).execute()
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"])}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        user=UserResponse(**user)
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_active_user)):
    return current_user