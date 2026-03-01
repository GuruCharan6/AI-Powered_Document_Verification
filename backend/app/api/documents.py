from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import List, Optional
import shutil, os, uuid, logging, asyncio
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from app.auth import get_current_active_user
from app.models import (UserResponse, DocumentResponse, DocumentDetailResponse,
                        ExtractedField, FraudCheck, VisualElement)
from app.database import get_supabase
from app.services.ocr_service import OCRService
from app.services.classification_service import DocumentClassifier
from app.services.extraction_service import FieldExtractor
from app.services.fraud_service import FraudDetector
from app.services.visual_service import VisualElementDetector
from app.services.explainer_service import ExplainerService

router = APIRouter()
logger = logging.getLogger(__name__)

# Singleton services
ocr_service      = OCRService()
classifier       = DocumentClassifier()
extractor        = FieldExtractor()
fraud_detector   = FraudDetector()
visual_detector  = VisualElementDetector()
explainer        = ExplainerService()

# Thread pool for CPU-bound tasks (OCR, OpenCV)
_executor = ThreadPoolExecutor(max_workers=4)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Background Processing ─────────────────────────────────────────────────────

async def process_document_async(
    file_id: str, local_path: str, file_url: str,
    document_type: Optional[str], user_id: str
):
    supabase = get_supabase()
    loop = asyncio.get_event_loop()

    try:
        logger.info(f"[{file_id}] Starting pipeline")

        # ── Step 1: OCR (run in thread — CPU bound) ──
        logger.info(f"[{file_id}] OCR...")
        raw_text = await loop.run_in_executor(_executor, ocr_service.get_raw_text, local_path)

        if not raw_text or len(raw_text.strip()) < 5:
            raise ValueError("No text could be extracted from the document")

        # ── Step 2: Classification ──
        logger.info(f"[{file_id}] Classification...")
        classification = await loop.run_in_executor(_executor, classifier.classify, raw_text)
        detected_doc_type = document_type or classification["document_type"]
        confidence = classification["confidence"]

        supabase.table("documents").update({
            "document_type": detected_doc_type,
            "confidence_score": confidence,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", file_id).execute()

        # ── Steps 3+4+5 in PARALLEL (extraction + fraud + visual) ──
        logger.info(f"[{file_id}] Running extraction, fraud & visual in parallel...")

        def run_extraction():
            return extractor.extract_fields(raw_text, detected_doc_type)

        def run_fraud():
            return fraud_detector.analyze(local_path, user_id)

        def run_visual():
            return visual_detector.detect(local_path)

        fields_raw, fraud_raw, visual_raw = await asyncio.gather(
            loop.run_in_executor(_executor, run_extraction),
            loop.run_in_executor(_executor, run_fraud),
            loop.run_in_executor(_executor, run_visual),
        )

        # ── Save extracted fields ──
        for field in fields_raw:
            supabase.table("extracted_fields").insert({
                "document_id": file_id,
                "field_name":         field["field_name"],
                "field_value":        field.get("field_value"),
                "confidence_score":   field.get("confidence_score", 0),
                "is_valid":           field.get("is_valid", False),
                "validation_message": field.get("validation_message", ""),
                "created_at":         datetime.utcnow().isoformat()
            }).execute()

        # ── Save fraud checks ──
        fraud_checks_objs = []
        for check in fraud_raw:
            supabase.table("fraud_checks").insert({
                "document_id":  file_id,
                "check_type":   check["check_type"],
                "is_suspicious": check["is_suspicious"],
                "risk_score":   check.get("risk_score", 0),
                "details":      check.get("details", {}),
                "created_at":   datetime.utcnow().isoformat()
            }).execute()
            fraud_checks_objs.append(check)

        # ── Save visual elements ──
        for el in visual_raw:
            supabase.table("visual_elements").insert({
                "document_id":    file_id,
                "element_type":   el["element_type"],
                "is_present":     el["is_present"],
                "confidence_score": el.get("confidence_score", 0),
                "details":        el.get("details", {}),
                "created_at":     datetime.utcnow().isoformat()
            }).execute()

        # ── Calculate final scores ──
        is_fraudulent   = any(c["is_suspicious"] for c in fraud_checks_objs)
        avg_fraud_risk  = sum(c.get("risk_score", 0) for c in fraud_checks_objs) / max(len(fraud_checks_objs), 1)
        avg_visual_conf = sum(v.get("confidence_score", 0) for v in visual_raw) / max(len(visual_raw), 1)

        supabase.table("documents").update({
            "status":                  "completed",
            "confidence_score":        confidence,
            "fraud_risk_score":        round(avg_fraud_risk, 2),
            "visual_confidence_score": round(avg_visual_conf, 2),
            "is_fraudulent":           is_fraudulent,
            "updated_at":              datetime.utcnow().isoformat()
        }).eq("id", file_id).execute()

        logger.info(f"[{file_id}] Processing complete ✓")

    except Exception as e:
        logger.error(f"[{file_id}] Processing failed: {e}")
        supabase.table("documents").update({
            "status": "failed",
            "error_message": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", file_id).execute()
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(None),
    current_user: UserResponse = Depends(get_current_active_user)
):
    supabase = get_supabase()

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum: 10MB")

    file_id   = str(uuid.uuid4())
    file_ext  = file.filename.rsplit(".", 1)[-1].lower()
    local_path = f"{UPLOAD_DIR}/{file_id}.{file_ext}"

    try:
        with open(local_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)

        # Supabase Storage upload (best-effort)
        storage_path = f"{current_user.id}/{file_id}.{file_ext}"
        file_url = f"/uploads/{file_id}.{file_ext}"
        try:
            with open(local_path, "rb") as f:
                supabase.storage.from_("documents").upload(
                    path=storage_path, file=f,
                    file_options={"content-type": file.content_type}
                )
            file_url = supabase.storage.from_("documents").get_public_url(storage_path)
        except Exception as se:
            logger.warning(f"Storage upload failed (continuing): {se}")

        doc_data = {
            "id": file_id,
            "user_id": str(current_user.id),
            "file_name": file.filename,
            "file_path": storage_path,
            "file_url": file_url,
            "file_size": file_size,
            "mime_type": file.content_type,
            "status": "processing",
            "document_type": document_type,
            "confidence_score": 0,
            "fraud_risk_score": 0,
            "visual_confidence_score": 0,
            "is_fraudulent": False,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        result   = supabase.table("documents").insert(doc_data).execute()
        document = result.data[0]

        background_tasks.add_task(
            process_document_async,
            file_id, local_path, file_url, document_type, str(current_user.id)
        )
        return DocumentResponse(**document)

    except Exception as e:
        if os.path.exists(local_path):
            os.remove(local_path)
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_active_user)
):
    supabase = get_supabase()
    query = supabase.table("documents").select("*").eq("user_id", str(current_user.id))
    if status:
        query = query.eq("status", status)
    response = query.order("created_at", desc=True).execute()
    return [DocumentResponse(**doc) for doc in response.data]


@router.get("/{document_id}/status")
async def get_document_status(
    document_id: str,
    current_user: UserResponse = Depends(get_current_active_user)
):
    supabase = get_supabase()
    doc = supabase.table("documents").select(
        "id, status, confidence_score, fraud_risk_score, is_fraudulent, error_message, updated_at"
    ).eq("id", document_id).eq("user_id", str(current_user.id)).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc.data


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: str,
    current_user: UserResponse = Depends(get_current_active_user)
):
    supabase = get_supabase()

    doc = supabase.table("documents").select("*").eq("id", document_id)\
        .eq("user_id", str(current_user.id)).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    fields_res  = supabase.table("extracted_fields").select("*").eq("document_id", document_id).execute()
    fraud_res   = supabase.table("fraud_checks").select("*").eq("document_id", document_id).execute()
    visual_res  = supabase.table("visual_elements").select("*").eq("document_id", document_id).execute()

    fields          = [ExtractedField(**f) for f in fields_res.data]
    fraud_checks    = [FraudCheck(**f) for f in fraud_res.data]
    visual_elements = [VisualElement(**v) for v in visual_res.data]

    avg_field_conf  = sum(f.confidence_score for f in fields) / max(len(fields), 1)
    max_fraud_risk  = max((f.risk_score for f in fraud_checks), default=0)
    visual_found    = sum(1 for v in visual_elements if v.is_present)

    return DocumentDetailResponse(
        **doc.data,
        extracted_fields=fields,
        fraud_checks=fraud_checks,
        visual_elements=visual_elements,
        summary={
            "avg_field_confidence":    round(avg_field_conf, 2),
            "fraud_risk_score":        max_fraud_risk,
            "visual_elements_detected": visual_found,
            "total_checks":            len(fraud_checks)
        }
    )


@router.get("/{document_id}/explain")
async def explain_document(
    document_id: str,
    current_user: UserResponse = Depends(get_current_active_user)
):
    """
    Generate AI explanation ONLY for completed documents that have extracted data.
    Returns a flat object the frontend can use directly.
    """
    supabase = get_supabase()

    doc = supabase.table("documents").select("*")\
        .eq("id", document_id).eq("user_id", str(current_user.id)).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    # ── Guard: only explain completed docs ──
    if doc.data.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for explanation (status: {doc.data.get('status')})"
        )

    fields_res = supabase.table("extracted_fields").select("*").eq("document_id", document_id).execute()
    fraud_res  = supabase.table("fraud_checks").select("*").eq("document_id", document_id).execute()

    # ── Guard: need actual data to explain ──
    if not fields_res.data and not fraud_res.data:
        raise HTTPException(status_code=400, detail="No extracted data available to explain")

    document_data = {
        "document_type":   doc.data.get("document_type"),
        "fields":          fields_res.data,
        "fraud_checks":    fraud_res.data,
        "confidence_scores": {
            "overall":     doc.data.get("confidence_score", 0),
            "fraud_risk":  doc.data.get("fraud_risk_score", 0),
            "visual":      doc.data.get("visual_confidence_score", 0)
        }
    }

    result = await explainer.explain_validation(document_data)

    # ── Return a flat, consistent shape ──
    # result is already: {explanation, verdict, valid_fields_count, invalid_fields_count, ...}
    return {
        "explanation":              result.get("explanation", ""),
        "verdict":                  result.get("verdict", "REVIEW"),
        "valid_fields_count":       result.get("valid_fields_count", 0),
        "invalid_fields_count":     result.get("invalid_fields_count", 0),
        "suspicious_checks_count":  result.get("suspicious_checks_count", 0),
        "overall_confidence":       doc.data.get("confidence_score", 0),
    }