import base64
import logging
import numpy as np
import cv2
import os
from typing import List, Dict, Any
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

_ocr_instances = {}

def get_ocr(lang='en'):
    global _ocr_instances
    if lang not in _ocr_instances:
        try:
            from paddleocr import PaddleOCR
            _ocr_instances[lang] = PaddleOCR(
                use_angle_cls=True,
                lang=lang,
                use_gpu=False,
                show_log=False,
            )
            logger.info(f"PaddleOCR initialized for lang={lang}")
        except Exception as e:
            logger.error(f"PaddleOCR init failed for lang={lang}: {e}")
            _ocr_instances[lang] = None
    return _ocr_instances[lang]


def pdf_to_image_path(pdf_path: str) -> str:
    """Convert first page of PDF to a PNG image for OCR/Vision processing"""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        page = doc[0]
        # Render at high DPI for better OCR quality
        mat = fitz.Matrix(1.5, 1.5)  # 1.5x zoom = ~108 DPI — faster, still readable
        pix = page.get_pixmap(matrix=mat)
        img_path = pdf_path.replace(".pdf", "_page1.png")
        pix.save(img_path)
        doc.close()
        logger.info(f"PDF converted to image: {img_path}")
        return img_path
    except ImportError:
        logger.error("PyMuPDF not installed. Run: pip install pymupdf")
        return ""
    except Exception as e:
        logger.error(f"PDF to image conversion failed: {e}")
        return ""


class OCRService:
    def __init__(self):
        self.groq = Groq(api_key=settings.GROQ_API_KEY)
        self.vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"

    def _resolve_image_path(self, file_path: str) -> str:
        """If file is PDF, convert to image first. Returns image path."""
        if file_path.lower().endswith(".pdf"):
            img_path = pdf_to_image_path(file_path)
            if img_path and os.path.exists(img_path):
                return img_path
            logger.warning("PDF conversion failed — will try PaddleOCR directly on PDF")
        return file_path

    def get_raw_text(self, image_path: str) -> str:
        """Groq Vision first (best for regional languages), PaddleOCR multilingual fallback"""
        # Resolve PDF to image for Groq Vision
        resolved_path = self._resolve_image_path(image_path)

        # Primary: Groq Vision
        groq_text = self._groq_vision_ocr(resolved_path)
        if groq_text and len(groq_text.strip()) > 20:
            logger.info(f"Groq Vision OCR success: {len(groq_text)} chars")
            return groq_text

        logger.info("Groq Vision insufficient — trying PaddleOCR multilingual fallback")

        # Fallback: Try Telugu, Hindi, Tamil, English with PaddleOCR
        all_texts = []
        for lang_code in ["te", "hi", "ta", "en"]:
            text = self._paddle_ocr(resolved_path, lang=lang_code)
            if text and len(text.strip()) > 20:
                all_texts.append(text)
                logger.info(f"PaddleOCR [{lang_code}] got {len(text)} chars")

        if all_texts:
            return max(all_texts, key=len)

        logger.error("All OCR methods failed")
        return ""

    def extract_text(self, image_path: str) -> List[Dict[str, Any]]:
        text = self.get_raw_text(image_path)
        return [{"text": line, "confidence": 90, "bbox": []}
                for line in text.split('\n') if line.strip()]

    # ── Groq Vision (primary) ─────────────────────────────────────────────────

    def _groq_vision_ocr(self, image_path: str) -> str:
        """Send image to Groq Vision. Must be an image file (not PDF)."""
        try:
            # Only process image files
            if image_path.lower().endswith(".pdf"):
                logger.warning("Groq Vision cannot process PDF directly — skipping")
                return ""

            if not os.path.exists(image_path):
                logger.error(f"Image file not found: {image_path}")
                return ""

            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")

            ext = image_path.lower().split(".")[-1]
            mime = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "webp": "image/webp"
            }.get(ext, "image/jpeg")

            response = self.groq.chat.completions.create(
                model=self.vision_model,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}},
                        {"type": "text", "text": (
                            "Extract ALL text from this Indian government document. "
                            "It may be in Telugu, Hindi, Tamil, Kannada, or English. "
                            "Rules: preserve original script + add English transliteration for regional text. "
                            "Keep all numbers, dates, IDs exact. Include stamps and authority names. "
                            "Output as plain text only."
                        )}
                    ]
                }],
                temperature=0.0,
                max_tokens=1500,  # reduced for speed — enough for most documents
            )
            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"Groq Vision OCR failed: {e}")
            return ""

    # ── PaddleOCR (fallback) ──────────────────────────────────────────────────

    def _paddle_ocr(self, image_path: str, lang: str = 'en') -> str:
        ocr = get_ocr(lang)
        if ocr is None:
            return ""
        try:
            # Preprocess only for image files
            processed = ""
            if not image_path.lower().endswith(".pdf"):
                processed = self._save_preprocessed(image_path)

            result = ocr.ocr(processed or image_path, cls=True)
            if not result or not result[0]:
                return ""
            lines = []
            for line in result[0]:
                if line and line[1][1] > 0.40:
                    lines.append(line[1][0])
            return "\n".join(lines)
        except Exception as e:
            logger.error(f"PaddleOCR [{lang}] failed: {e}")
            return ""

    # ── Image preprocessing ───────────────────────────────────────────────────

    def _save_preprocessed(self, image_path: str) -> str:
        try:
            img = cv2.imread(image_path)
            if img is None:
                return ""

            h, w = img.shape[:2]
            if h < 1000 or w < 1000:
                scale = max(1000 / h, 1000 / w)
                img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

            img = self._deskew(img)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.fastNlMeansDenoising(gray, h=10)
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            gray = cv2.filter2D(gray, -1, kernel)
            thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 31, 8
            )
            out = image_path.replace(".", "_proc.")
            cv2.imwrite(out, thresh)
            return out
        except Exception as e:
            logger.warning(f"Preprocessing failed: {e}")
            return ""

    def _deskew(self, img: np.ndarray) -> np.ndarray:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.bitwise_not(gray)
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = 90 + angle
            if abs(angle) < 0.5:
                return img
            h, w = img.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        except Exception:
            return img