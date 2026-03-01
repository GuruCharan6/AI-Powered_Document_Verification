from fastapi import APIRouter, Depends
from app.auth import get_current_active_user
from app.models import UserResponse, DashboardStats
from app.database import get_supabase
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_active_user)):
    """Get dashboard statistics"""
    supabase = get_supabase()
    
    # Total documents
    total_response = supabase.table("documents").select("*", count="exact").eq("user_id", str(current_user.id)).execute()
    total = total_response.count
    
    # Processed today
    today_start = (datetime.utcnow() - timedelta(days=1)).isoformat()
    today_response = supabase.table("documents").select("*", count="exact").eq("user_id", str(current_user.id)).gte("created_at", today_start).execute()
    today_count = today_response.count
    
    # Pending
    pending_response = supabase.table("documents").select("*", count="exact").eq("user_id", str(current_user.id)).eq("status", "pending").execute()
    pending = pending_response.count
    
    # Fraud detected
    fraud_response = supabase.table("fraud_checks").select("documents!inner(user_id), is_suspicious").eq("documents.user_id", str(current_user.id)).eq("is_suspicious", True).execute()
    fraud_count = len([f for f in fraud_response.data if f["is_suspicious"]])
    
    # Average confidence
    docs_with_confidence = supabase.table("documents").select("confidence_score").eq("user_id", str(current_user.id)).not_.is_("confidence_score", "null").execute()
    avg_confidence = 0
    if docs_with_confidence.data:
        scores = [d["confidence_score"] for d in docs_with_confidence.data if d["confidence_score"]]
        avg_confidence = sum(scores) / len(scores) if scores else 0
    
    # Average fraud risk - get from fraud_checks table
    avg_fraud_risk = 0
    try:
        fraud_risk_response = supabase.table("fraud_checks").select(
            "risk_score, documents!inner(user_id)"
        ).eq("documents.user_id", str(current_user.id)).execute()
        if fraud_risk_response.data:
            risks = [f["risk_score"] for f in fraud_risk_response.data if f.get("risk_score") is not None]
            avg_fraud_risk = sum(risks) / len(risks) if risks else 0
    except Exception:
        avg_fraud_risk = 0
    
    return DashboardStats(
        total_documents=total,
        processed_today=today_count,
        pending_documents=pending,
        fraud_detected=fraud_count,
        average_confidence=round(avg_confidence, 2),
        average_fraud_risk=round(avg_fraud_risk, 2)
    )

@router.get("/recent-activity")
async def get_recent_activity(current_user: UserResponse = Depends(get_current_active_user)):
    """Get recent document processing activity"""
    supabase = get_supabase()
    
    response = supabase.table("documents").select(
        "id, file_name, status, document_type, created_at, confidence_score"
    ).eq("user_id", str(current_user.id)).order("created_at", desc=True).limit(10).execute()
    
    return response.data

@router.get("/fraud-summary")
async def get_fraud_summary(current_user: UserResponse = Depends(get_current_active_user)):
    """Get fraud detection summary"""
    supabase = get_supabase()
    
    # Get all fraud checks for user's documents
    response = supabase.table("fraud_checks").select(
        "check_type, is_suspicious, risk_score, documents!inner(user_id)"
    ).eq("documents.user_id", str(current_user.id)).execute()
    
    summary = {}
    for check in response.data:
        check_type = check["check_type"]
        if check_type not in summary:
            summary[check_type] = {"total": 0, "suspicious": 0, "avg_risk": 0}
        
        summary[check_type]["total"] += 1
        if check["is_suspicious"]:
            summary[check_type]["suspicious"] += 1
        summary[check_type]["avg_risk"] += check.get("risk_score", 0)
    
    # Calculate averages
    for check_type in summary:
        total = summary[check_type]["total"]
        if total > 0:
            summary[check_type]["avg_risk"] = round(summary[check_type]["avg_risk"] / total, 2)
    
    return summary