import base64
import logging
import numpy as np
import cv2
from typing import List, Dict, Any
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        try:
            from paddleocr import PaddleOCR
            # Multi-language: English + Hindi + Telugu + Tamil + Kannada + Bengali + Marathi
            _ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',       # PaddleOCR handles Devanagari via 'en' + 'hindi' models
                use_gpu=False,
                show_log=False,
            )
            logger.info("PaddleOCR initialized")
        except Exception as e:
            logger.error(f"PaddleOCR init failed: {e}")
            _ocr = None
    return _ocr


class OCRService:
    def __init__(self):
        self.groq = Groq(api_key=settings.GROQ_API_KEY)
        self.vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"

    def get_raw_text(self, image_path: str) -> str:
        """Groq Vision first (multilingual), PaddleOCR fallback"""
        groq_text = self._groq_vision_ocr(image_path)
        if groq_text and len(groq_text.strip()) > 20:
            logger.info(f"Groq Vision OCR: {len(groq_text)} chars")
            return groq_text

        logger.info("Groq Vision insufficient — trying PaddleOCR")
        paddle_text = self._paddle_ocr(image_path)
        if paddle_text:
            return paddle_text

        logger.error("Both OCR methods failed")
        return ""

    def extract_text(self, image_path: str) -> List[Dict[str, Any]]:
        text = self.get_raw_text(image_path)
        return [{"text": line, "confidence": 90, "bbox": []}
                for line in text.split('\n') if line.strip()]

    # ── Groq Vision (primary) ─────────────────────────────────────────────────

    def _groq_vision_ocr(self, image_path: str) -> str:
        try:
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")

            ext = image_path.lower().split(".")[-1]
            mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext, "image/jpeg")

            response = self.groq.chat.completions.create(
                model=self.vision_model,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}},
                        {"type": "text", "text": (
                            "This is an Indian government document. It may be written in English, Hindi, "
                            "Telugu, Tamil, Kannada, Marathi, Bengali, Gujarati, Malayalam, Punjabi, "
                            "Odia, or any other Indian regional language.\n\n"
                            "Extract ALL text visible in this document exactly as printed, preserving "
                            "the original script/language for each field.\n"
                            "Include transliteration in English if the text is in a regional script.\n"
                            "Format: one field per line. Include every number, date, name, ID, address, "
                            "stamp text, and watermark.\n"
                            "Do NOT summarize. Output raw extracted text only."
                        )}
                    ]
                }],
                temperature=0.0,
                max_tokens=2500,
            )
            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"Groq Vision OCR failed: {e}")
            return ""

    # ── PaddleOCR (fallback) ──────────────────────────────────────────────────

    def _paddle_ocr(self, image_path: str) -> str:
        ocr = get_ocr()
        if ocr is None:
            return ""
        try:
            processed = self._save_preprocessed(image_path)
            result = ocr.ocr(processed or image_path, cls=True)
            if not result or not result[0]:
                return ""
            return "\n".join(line[1][0] for line in result[0] if line and line[1][1] > 0.45)
        except Exception as e:
            logger.error(f"PaddleOCR failed: {e}")
            return ""

    # ── Image preprocessing ───────────────────────────────────────────────────

    def _save_preprocessed(self, image_path: str) -> str:
        try:
            img = cv2.imread(image_path)
            if img is None:
                return ""

            h, w = img.shape[:2]
            if h < 1200 or w < 1200:
                scale = max(1200 / h, 1200 / w)
                img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

            img = self._deskew(img)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.fastNlMeansDenoising(gray, h=10)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            gray = cv2.filter2D(gray, -1, kernel)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                           cv2.THRESH_BINARY, 31, 10)
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