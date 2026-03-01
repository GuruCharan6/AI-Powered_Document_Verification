import cv2
import numpy as np
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class VisualElementDetector:
    """Detect stamps, signatures, photos, and seals in Indian government documents"""

    def detect(self, image_path: str) -> List[Dict[str, Any]]:
        results = []
        detectors = [
            ("stamp",     self._detect_stamps),
            ("signature", self._detect_signatures),
            ("photo",     self._detect_photos),
            ("seal",      self._detect_seals),
            ("watermark", self._detect_watermark),
        ]
        for element_type, fn in detectors:
            try:
                results.append(fn(image_path))
            except Exception as e:
                logger.error(f"{element_type} detection failed: {e}")
                results.append({"element_type": element_type, "is_present": False,
                                 "confidence_score": 0, "details": {}})
        return results

    # ── Stamps ────────────────────────────────────────────────────────────────

    def _detect_stamps(self, image_path: str) -> Dict[str, Any]:
        img = cv2.imread(image_path)
        if img is None:
            return self._empty("stamp")

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # Color ranges for stamps (blue, red, green, purple)
        color_ranges = [
            ("blue",   np.array([100, 50, 50]),  np.array([130, 255, 255])),
            ("red1",   np.array([0, 100, 100]),   np.array([10, 255, 255])),
            ("red2",   np.array([160, 100, 100]), np.array([180, 255, 255])),
            ("green",  np.array([40, 50, 50]),    np.array([80, 255, 255])),
            ("purple", np.array([130, 50, 50]),   np.array([160, 255, 255])),
        ]

        best = None
        for color_name, lo, hi in color_ranges:
            mask = cv2.inRange(hsv, lo, hi)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if 800 < area < 60000:
                    x, y, w, h = cv2.boundingRect(cnt)
                    ar = w / h if h > 0 else 0
                    if 0.4 < ar < 2.5:
                        score = min(area / 800, 95)
                        if not best or score > best["confidence_score"]:
                            best = {
                                "element_type": "stamp",
                                "is_present": True,
                                "confidence_score": round(score, 1),
                                "details": {"color": color_name, "area": int(area),
                                            "bbox": [int(x), int(y), int(x+w), int(y+h)]}
                            }

        return best or self._empty("stamp")

    # ── Signatures ────────────────────────────────────────────────────────────

    def _detect_signatures(self, image_path: str) -> Dict[str, Any]:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return self._empty("signature")

        _, thresh = cv2.threshold(img, 160, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (6, 3))
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best = None
        h_img = img.shape[0]
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            area = cv2.contourArea(cnt)
            ar = w / h if h > 0 else 0
            # Signatures: wide, medium area, preferably in lower 60% of document
            if 2.5 < ar < 25 and 400 < area < 25000 and w > 80 and h > 15:
                score = min(area / 180, 92)
                # Boost score if in lower portion of document
                if y > h_img * 0.4:
                    score = min(score + 10, 95)
                if not best or score > best["confidence_score"]:
                    best = {
                        "element_type": "signature",
                        "is_present": True,
                        "confidence_score": round(score, 1),
                        "details": {"bbox": [int(x), int(y), int(x+w), int(y+h)],
                                    "aspect_ratio": round(ar, 2)}
                    }

        return best or self._empty("signature")

    # ── Photo ─────────────────────────────────────────────────────────────────

    def _detect_photos(self, image_path: str) -> Dict[str, Any]:
        img = cv2.imread(image_path)
        if img is None:
            return self._empty("photo")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

        # Try multiple scale factors for better detection
        for scale in [1.05, 1.1, 1.2]:
            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=scale, minNeighbors=4,
                minSize=(40, 40), maxSize=(600, 600)
            )
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                confidence = min((w * h) / 8000, 95)
                return {
                    "element_type": "photo",
                    "is_present": True,
                    "confidence_score": round(confidence, 1),
                    "details": {"face_count": len(faces),
                                "bbox": [int(x), int(y), int(x+w), int(y+h)]}
                }

        # Fallback: look for rectangular region with skin-like tones (passport photo area)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        skin_mask = cv2.inRange(hsv, np.array([0, 20, 70]), np.array([20, 150, 255]))
        contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 3000 < area < 80000:
                x, y, w, h = cv2.boundingRect(cnt)
                ar = w / h if h > 0 else 0
                if 0.5 < ar < 1.5:
                    return {
                        "element_type": "photo",
                        "is_present": True,
                        "confidence_score": 55.0,
                        "details": {"method": "skin_tone", "bbox": [int(x), int(y), int(x+w), int(y+h)]}
                    }

        return self._empty("photo")

    # ── Seal ──────────────────────────────────────────────────────────────────

    def _detect_seals(self, image_path: str) -> Dict[str, Any]:
        img = cv2.imread(image_path)
        if img is None:
            return self._empty("seal")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        try:
            circles = cv2.HoughCircles(
                blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=80,
                param1=60, param2=35, minRadius=25, maxRadius=180
            )
        except Exception:
            circles = None

        if circles is not None:
            circles = np.uint16(np.around(circles))
            x, y, r = circles[0][0]
            confidence = min(float(r) * 0.6, 90)
            return {
                "element_type": "seal",
                "is_present": True,
                "confidence_score": round(confidence, 1),
                "details": {"radius": int(r), "center": [int(x), int(y)],
                            "bbox": [int(x-r), int(y-r), int(x+r), int(y+r)]}
            }

        return self._empty("seal")

    # ── Watermark ─────────────────────────────────────────────────────────────

    def _detect_watermark(self, image_path: str) -> Dict[str, Any]:
        try:
            img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                return self._empty("watermark")

            # Watermarks show up as semi-transparent patterns
            _, thresh = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY_INV)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
            morphed = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

            white_ratio = np.sum(morphed > 0) / morphed.size
            is_present = bool(0.02 < white_ratio < 0.4)
            confidence = round(min(white_ratio * 200, 80), 1) if is_present else 0

            return {
                "element_type": "watermark",
                "is_present": is_present,
                "confidence_score": confidence,
                "details": {"coverage_ratio": round(float(white_ratio), 4)}
            }
        except Exception as e:
            return self._empty("watermark")

    def _empty(self, element_type: str) -> Dict[str, Any]:
        return {"element_type": element_type, "is_present": False,
                "confidence_score": 0, "details": {}}