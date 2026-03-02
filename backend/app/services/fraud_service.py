import cv2
import numpy as np
import hashlib
import logging
from PIL import Image
from typing import Dict, Any, List
from app.database import get_supabase

logger = logging.getLogger(__name__)

def _f(v): return float(v) if v is not None else 0.0
def _i(v): return int(v) if v is not None else 0
def _b(v): return bool(v)


class FraudDetector:
    def __init__(self):
        self.checks = [
            self.check_tampering,
            self.check_metadata,
            self.check_quality,
            self.check_duplicates,
        ]

    def analyze(self, image_path: str, user_id: str) -> List[Dict[str, Any]]:
        results = []
        for check in self.checks:
            try:
                results.append(check(image_path, user_id))
            except Exception as e:
                logger.error(f"{check.__name__} failed: {e}")
                results.append({
                    "check_type": check.__name__.replace("check_", ""),
                    "is_suspicious": False, "risk_score": 0,
                    "details": {"error": str(e)}
                })
        return results

    # ── Tampering ─────────────────────────────────────────────────────────────

    def check_tampering(self, image_path: str, user_id: str) -> Dict[str, Any]:
        try:
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError("Could not read image")

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            noise = _f(cv2.Laplacian(gray, cv2.CV_64F).var())

            # ORB keypoint analysis (much faster than SIFT)
            orb = cv2.ORB_create(nfeatures=500)
            kps = orb.detect(gray, None)
            kp_count = len(kps)

            # ELA: compare original vs re-compressed JPEG
            _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 75])
            recompressed = cv2.imdecode(buf, cv2.IMREAD_COLOR)
            ela = cv2.absdiff(img, recompressed)
            ela_mean = _f(np.mean(ela))

            suspicious_noise = noise < 20 or noise > 2000
            suspicious_ela   = ela_mean > 15
            suspicious_kp    = kp_count < 30

            indicators = []
            if suspicious_noise: indicators.append(f"Abnormal noise: {noise:.1f}")
            if suspicious_ela:   indicators.append(f"High ELA (editing artifacts): {ela_mean:.1f}")
            if suspicious_kp:    indicators.append(f"Low feature points: {kp_count}")

            is_suspicious = _b(suspicious_noise or suspicious_ela or suspicious_kp)
            risk = min(len(indicators) * 25, 90) if is_suspicious else 8

            return {
                "check_type": "tamper_detection",
                "is_suspicious": is_suspicious,
                "risk_score": risk,
                "details": {
                    "noise_level": noise,
                    "ela_score": ela_mean,
                    "keypoints": kp_count,
                    "indicators": indicators,
                }
            }
        except Exception as e:
            return {"check_type": "tamper_detection", "is_suspicious": False,
                    "risk_score": 0, "details": {"error": str(e)}}

    # ── Metadata ──────────────────────────────────────────────────────────────

    def check_metadata(self, image_path: str, user_id: str) -> Dict[str, Any]:
        try:
            from PIL.ExifTags import TAGS
            image = Image.open(image_path)
            exif  = image._getexif()

            metadata = {}
            editing_software_found = []
            EDITING_SW = ["photoshop", "gimp", "lightroom", "canva", "pixlr",
                          "snapseed", "picsart", "facetune"]

            if exif:
                for tag_id, val in exif.items():
                    tag = TAGS.get(tag_id, str(tag_id))
                    metadata[tag] = str(val)
                    for sw in EDITING_SW:
                        if sw in str(val).lower():
                            editing_software_found.append(sw)

            has_camera = any(t in metadata for t in ["Make", "Model", "LensMake"])
            suspicious = _b(len(editing_software_found) > 0)
            risk = 60 if editing_software_found else (15 if not has_camera and metadata else 5)

            return {
                "check_type": "metadata_analysis",
                "is_suspicious": suspicious,
                "risk_score": risk,
                "details": {
                    "camera_info_present": has_camera,
                    "editing_software": editing_software_found,
                    "metadata_fields": _i(len(metadata)),
                }
            }
        except Exception as e:
            return {"check_type": "metadata_analysis", "is_suspicious": False,
                    "risk_score": 0, "details": {"error": str(e)}}

    # ── Quality ───────────────────────────────────────────────────────────────

    def check_quality(self, image_path: str, user_id: str) -> Dict[str, Any]:
        try:
            img  = cv2.imread(image_path)
            if img is None: raise ValueError("Cannot read image")

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            blur = _f(cv2.Laplacian(gray, cv2.CV_64F).var())
            brightness = _f(np.mean(gray))
            h, w = img.shape[:2]

            issues = []
            if blur < 80:         issues.append(f"Blurry image (score: {blur:.0f})")
            if h < 500 or w < 500:issues.append(f"Low resolution ({w}x{h})")
            if brightness < 40:   issues.append("Too dark")
            if brightness > 220:  issues.append("Overexposed")

            is_suspicious = _b(len(issues) > 0)
            risk = min(len(issues) * 20, 60) if is_suspicious else 0

            return {
                "check_type": "quality_check",
                "is_suspicious": is_suspicious,
                "risk_score": risk,
                "details": {
                    "blur_score": blur,
                    "resolution": f"{w}x{h}",
                    "brightness": brightness,
                    "issues": issues,
                }
            }
        except Exception as e:
            return {"check_type": "quality_check", "is_suspicious": False,
                    "risk_score": 0, "details": {"error": str(e)}}

    # ── Duplicates ────────────────────────────────────────────────────────────

    def check_duplicates(self, image_path: str, user_id: str) -> Dict[str, Any]:
        try:
            with open(image_path, 'rb') as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()

            supabase = get_supabase()
            # Check if same user already uploaded this exact file
            existing = supabase.table("documents")\
                .select("id, file_name, created_at")\
                .eq("user_id", user_id)\
                .execute()

            # Simple count-based heuristic (hash comparison would need DB column)
            duplicates = [d for d in existing.data if d.get("file_name") == image_path.split("/")[-1]]
            is_dup = _b(len(duplicates) > 1)

            return {
                "check_type": "duplicate_check",
                "is_suspicious": is_dup,
                "risk_score": 75 if is_dup else 5,
                "details": {
                    "file_hash": file_hash[:20] + "...",
                    "duplicate_count": _i(max(0, len(duplicates) - 1)),
                }
            }
        except Exception as e:
            return {"check_type": "duplicate_check", "is_suspicious": False,
                    "risk_score": 0, "details": {"error": str(e)}}