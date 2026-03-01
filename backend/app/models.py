from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# Auth Models
class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    department: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    department: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Document Models
class DocumentUpload(BaseModel):
    file_name: str
    document_type: Optional[str] = None


class DocumentResponse(BaseModel):
    id: UUID
    file_name: str
    status: str
    document_type: Optional[str]
    confidence_score: Optional[float] = 0
    fraud_risk_score: Optional[float] = 0
    visual_confidence_score: Optional[float] = 0
    is_fraudulent: Optional[bool] = False
    file_url: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ExtractedField(BaseModel):
    id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    field_name: str
    field_value: Optional[str] = None
    confidence_score: Optional[float] = 0
    is_valid: Optional[bool] = False
    validation_message: Optional[str] = None
    created_at: Optional[datetime] = None


class FraudCheck(BaseModel):
    id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    check_type: str
    is_suspicious: bool
    risk_score: Optional[float] = 0
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class VisualElement(BaseModel):
    id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    element_type: str
    is_present: bool
    confidence_score: Optional[float] = 0
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class DocumentDetailResponse(DocumentResponse):
    extracted_fields: List[ExtractedField] = []
    fraud_checks: List[FraudCheck] = []
    visual_elements: List[VisualElement] = []
    summary: Optional[Dict[str, Any]] = None


# Dashboard Models
class DashboardStats(BaseModel):
    total_documents: int
    processed_today: int
    pending_documents: int
    fraud_detected: int
    average_confidence: float
    average_fraud_risk: float = 0