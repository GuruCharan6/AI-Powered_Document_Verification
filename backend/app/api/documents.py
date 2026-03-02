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

ocr_service     = OCRService()
classifier      = DocumentClassifier()
extractor       = FieldExtractor()
fraud_detector  = FraudDetector()
visual_detector = VisualElementDetector()
explainer       = ExplainerService()

_executor = ThreadPoolExecutor(max_workers=4)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def safe_supabase_update(file_id: str, data: dict, retries: int = 3):
    """Supabase update with retry logic to handle connection drops"""
    for attempt in range(retries):
        try:
            supabase = get_supabase()
            supabase.table("documents").update(data).eq("id", file_id).execute()
            return
        except Exception as e:
            logger.warning(f"[{file_id}] Supabase update attempt {attempt+1} failed: {e}")
            if attempt < retries - 1:
                import time
                time.sleep(1)
    logger.error(f"[{file_id}] All Supabase update attempts failed")


# ── Background Processing ─────────────────────────────────────────────────────

async def process_document_async(
    file_id: str, local_path: str, file_url: str,
    document_type: Optional[str], user_id: str
):
    loop = asyncio.get_event_loop()
    converted_img_path = None  # track PDF→image conversion for cleanup

    try:
        logger.info(f"[{file_id}] Starting pipeline")

        # ── Step 1: OCR ──────────────────────────────────────────────────────
        logger.info(f"[{file_id}] OCR starting...")

        # Convert PDF to image first if needed
        is_pdf = local_path.lower().endswith(".pdf")
        if is_pdf:
            from app.services.ocr_service import pdf_to_image_path
            converted_img_path = await loop.run_in_executor(
                _executor, pdf_to_image_path, local_path
            )
            ocr_input_path = converted_img_path if converted_img_path else local_path
            logger.info(f"[{file_id}] PDF converted to image: {ocr_input_path}")
        else:
            ocr_input_path = local_path

        raw_text = await loop.run_in_executor(_executor, ocr_service.get_raw_text, ocr_input_path)

        # Retry with Groq Vision if minimal text
        if not raw_text or len(raw_text.strip()) < 10:
            logger.warning(f"[{file_id}] Minimal OCR text — retrying with Groq Vision")
            if ocr_input_path and not ocr_input_path.lower().endswith(".pdf"):
                raw_text = await loop.run_in_executor(
                    _executor, ocr_service._groq_vision_ocr, ocr_input_path
                )

        # Use placeholder if all OCR fails — don't crash pipeline
        if not raw_text or len(raw_text.strip()) < 5:
            logger.error(f"[{file_id}] OCR completely failed — using placeholder")
            raw_text = f"document type: {document_type or 'unknown'}"

        logger.info(f"[{file_id}] OCR done: {len(raw_text)} chars")

        # ── Step 2: Classification ────────────────────────────────────────────
        if document_type and document_type != "unknown":
            detected_doc_type = document_type
            confidence = 85.0
        else:
            classification = await loop.run_in_executor(_executor, classifier.classify, raw_text)
            detected_doc_type = classification["document_type"]
            confidence = classification["confidence"]

            if detected_doc_type == "unknown" or confidence < 30:
                try:
                    ai_cls = await loop.run_in_executor(
                        _executor, classifier._classify_with_ai, raw_text
                    )
                    if ai_cls["confidence"] > confidence:
                        detected_doc_type = ai_cls["document_type"]
                        confidence = ai_cls["confidence"]
                except Exception as ce:
                    logger.warning(f"[{file_id}] AI reclassification failed: {ce}")

            if detected_doc_type == "unknown" and document_type:
                detected_doc_type = document_type
                confidence = 50.0

        safe_supabase_update(file_id, {
            "document_type":  detected_doc_type,
            "confidence_score": confidence,
            "updated_at":     datetime.utcnow().isoformat()
        })
        logger.info(f"[{file_id}] Classified: {detected_doc_type} ({confidence}%)")

        # ── Steps 3+4+5: Parallel ────────────────────────────────────────────

        def run_extraction():
            try:
                return extractor.extract_fields(raw_text, detected_doc_type)
            except Exception as e:
                logger.error(f"[{file_id}] Extraction error: {e}")
                return [{"field_name": "error", "field_value": str(e),
                         "confidence_score": 0, "is_valid": False,
                         "validation_message": "Extraction failed"}]

        def run_fraud():
            try:
                return fraud_detector.analyze(ocr_input_path, user_id)
            except Exception as e:
                logger.error(f"[{file_id}] Fraud error: {e}")
                return [{"check_type": "error", "is_suspicious": False,
                         "risk_score": 0, "details": {"error": str(e)}}]

        def run_visual():
            try:
                return visual_detector.detect(ocr_input_path)
            except Exception as e:
                logger.error(f"[{file_id}] Visual error: {e}")
                return []

        fields_raw, fraud_raw, visual_raw = await asyncio.gather(
            loop.run_in_executor(_executor, run_extraction),
            loop.run_in_executor(_executor, run_fraud),
            loop.run_in_executor(_executor, run_visual),
        )

        # ── Save to DB ────────────────────────────────────────────────────────
        supabase = get_supabase()

        for field in fields_raw:
            try:
                supabase.table("extracted_fields").insert({
                    "document_id":        file_id,
                    "field_name":         field.get("field_name", "unknown"),
                    "field_value":        str(field.get("field_value", "")) if field.get("field_value") else None,
                    "confidence_score":   field.get("confidence_score", 0),
                    "is_valid":           field.get("is_valid", False),
                    "validation_message": field.get("validation_message", ""),
                    "verdict_color":      field.get("verdict_color"),
                    "verdict_icon":       field.get("verdict_icon"),
                    "created_at":         datetime.utcnow().isoformat()
                }).execute()
            except Exception as fe:
                logger.warning(f"[{file_id}] Field save failed: {fe}")

        fraud_checks_objs = []
        for check in fraud_raw:
            try:
                supabase.table("fraud_checks").insert({
                    "document_id":   file_id,
                    "check_type":    check.get("check_type", "unknown"),
                    "is_suspicious": check.get("is_suspicious", False),
                    "risk_score":    check.get("risk_score", 0),
                    "details":       check.get("details", {}),
                    "created_at":    datetime.utcnow().isoformat()
                }).execute()
                fraud_checks_objs.append(check)
            except Exception as fce:
                logger.warning(f"[{file_id}] Fraud check save failed: {fce}")

        for el in visual_raw:
            try:
                supabase.table("visual_elements").insert({
                    "document_id":      file_id,
                    "element_type":     el.get("element_type", "unknown"),
                    "is_present":       el.get("is_present", False),
                    "confidence_score": el.get("confidence_score", 0),
                    "details":          el.get("details", {}),
                    "created_at":       datetime.utcnow().isoformat()
                }).execute()
            except Exception as ve:
                logger.warning(f"[{file_id}] Visual element save failed: {ve}")

        # ── Final verdict & scores ────────────────────────────────────────────
        verdict_field   = next((f for f in fields_raw if f.get("field_name") == "__verdict__"), None)
        overall_verdict = verdict_field.get("field_value", "UNKNOWN") if verdict_field else "UNKNOWN"
        verdict_color   = verdict_field.get("verdict_color", "gray") if verdict_field else "gray"

        is_fraudulent   = any(c.get("is_suspicious", False) for c in fraud_checks_objs)
        avg_fraud_risk  = sum(c.get("risk_score", 0) for c in fraud_checks_objs) / max(len(fraud_checks_objs), 1)
        avg_visual_conf = sum(v.get("confidence_score", 0) for v in visual_raw) / max(len(visual_raw), 1)

        safe_supabase_update(file_id, {
            "status":                  "completed",
            "confidence_score":        round(confidence, 2),
            "fraud_risk_score":        round(avg_fraud_risk, 2),
            "visual_confidence_score": round(avg_visual_conf, 2),
            "is_fraudulent":           is_fraudulent,
            "overall_verdict":         overall_verdict,
            "verdict_color":           verdict_color,
            "updated_at":              datetime.utcnow().isoformat()
        })

        logger.info(f"[{file_id}] Complete ✓ — Verdict: {overall_verdict}")

    except Exception as e:
        logger.error(f"[{file_id}] Pipeline failed: {e}", exc_info=True)
        safe_supabase_update(file_id, {
            "status":        "failed",
            "error_message": str(e),
            "updated_at":    datetime.utcnow().isoformat()
        })
    finally:
        # Cleanup local files
        for path in [local_path, converted_img_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass
        # Cleanup preprocessed image
        if local_path:
            proc = local_path.replace(".", "_proc.")
            if os.path.exists(proc):
                try:
                    os.remove(proc)
                except Exception:
                    pass


# ── Routes ────────────────────────────────────────────────────────────────────

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

    file_id    = str(uuid.uuid4())
    file_ext   = file.filename.rsplit(".", 1)[-1].lower()
    local_path = f"{UPLOAD_DIR}/{file_id}.{file_ext}"

    try:
        with open(local_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)

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
            "id":                      file_id,
            "user_id":                 str(current_user.id),
            "file_name":               file.filename,
            "file_path":               storage_path,
            "file_url":                file_url,
            "file_size":               file_size,
            "mime_type":               file.content_type,
            "status":                  "processing",
            "document_type":           document_type,
            "confidence_score":        0,
            "fraud_risk_score":        0,
            "visual_confidence_score": 0,
            "is_fraudulent":           False,
            "overall_verdict":         "PENDING",
            "verdict_color":           "gray",
            "created_at":              datetime.utcnow().isoformat(),
            "updated_at":              datetime.utcnow().isoformat()
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
    try:
        supabase = get_supabase()
        doc = supabase.table("documents").select(
            "id, status, confidence_score, fraud_risk_score, is_fraudulent, "
            "overall_verdict, verdict_color, error_message, updated_at"
        ).eq("id", document_id).eq("user_id", str(current_user.id)).single().execute()
        if not doc.data:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status fetch failed for {document_id}: {e}")
        # Return a safe fallback instead of crashing with 500
        return {
            "id": document_id,
            "status": "processing",
            "confidence_score": 0,
            "fraud_risk_score": 0,
            "is_fraudulent": False,
            "overall_verdict": "PENDING",
            "verdict_color": "gray",
            "error_message": None,
            "updated_at": datetime.utcnow().isoformat()
        }


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

    verdict_field   = next((f for f in fields if f.field_name == "__verdict__"), None)
    overall_verdict = verdict_field.field_value if verdict_field else doc.data.get("overall_verdict", "UNKNOWN")

    return DocumentDetailResponse(
        **doc.data,
        extracted_fields=fields,
        fraud_checks=fraud_checks,
        visual_elements=visual_elements,
        summary={
            "avg_field_confidence":     round(avg_field_conf, 2),
            "fraud_risk_score":         max_fraud_risk,
            "visual_elements_detected": visual_found,
            "total_checks":             len(fraud_checks),
            "overall_verdict":          overall_verdict,
        }
    )


@router.get("/{document_id}/explain")
async def explain_document(
    document_id: str,
    current_user: UserResponse = Depends(get_current_active_user)
):
    supabase = get_supabase()

    doc = supabase.table("documents").select("*")\
        .eq("id", document_id).eq("user_id", str(current_user.id)).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.data.get("status") != "completed":
        raise HTTPException(status_code=400,
            detail=f"Document not ready (status: {doc.data.get('status')})")

    fields_res = supabase.table("extracted_fields").select("*").eq("document_id", document_id).execute()
    fraud_res  = supabase.table("fraud_checks").select("*").eq("document_id", document_id).execute()

    if not fields_res.data and not fraud_res.data:
        raise HTTPException(status_code=400, detail="No extracted data available")

    verdict_field   = next((f for f in fields_res.data if f.get("field_name") == "__verdict__"), None)
    overall_verdict = verdict_field.get("field_value", "UNKNOWN") if verdict_field else \
                      doc.data.get("overall_verdict", "UNKNOWN")

    document_data = {
        "document_type": doc.data.get("document_type"),
        "fields":        fields_res.data,
        "fraud_checks":  fraud_res.data,
        "confidence_scores": {
            "overall":    doc.data.get("confidence_score", 0),
            "fraud_risk": doc.data.get("fraud_risk_score", 0),
            "visual":     doc.data.get("visual_confidence_score", 0)
        }
    }

    result = await explainer.explain_validation(document_data)

    return {
        "explanation":             result.get("explanation", ""),
        "verdict":                 overall_verdict,
        "verdict_icon":            verdict_field.get("verdict_icon", "❓") if verdict_field else "❓",
        "verdict_color":           verdict_field.get("verdict_color", "gray") if verdict_field else "gray",
        "valid_fields_count":      result.get("valid_fields_count", 0),
        "invalid_fields_count":    result.get("invalid_fields_count", 0),
        "suspicious_checks_count": result.get("suspicious_checks_count", 0),
        "overall_confidence":      doc.data.get("confidence_score", 0),
    }