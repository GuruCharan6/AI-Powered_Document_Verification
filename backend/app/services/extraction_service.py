import re
import json
import logging
from typing import List, Dict, Any
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)


class FieldExtractor:
    """AI-powered field extractor for Indian government documents with multilingual support and validity verdict"""

    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    DOCUMENT_FIELDS = {
        "aadhaar":              ["name", "dob", "gender", "aadhaar_number", "address", "pincode"],
        "pan":                  ["name", "father_name", "dob", "pan_number"],
        "passport":             ["name", "dob", "passport_number", "nationality", "expiry_date",
                                 "place_of_birth", "issue_date", "place_of_issue"],
        "driving_license":      ["name", "dob", "dl_number", "address", "issue_date",
                                 "expiry_date", "vehicle_class"],
        "voter_id":             ["name", "father_name", "dob", "voter_id_number",
                                 "address", "part_number", "assembly_constituency"],
        "ration_card":          ["head_of_family", "ration_card_number", "card_type",
                                 "address", "family_members", "district", "state", "issued_date"],
        "caste_certificate":    ["name", "father_name", "caste", "sub_caste", "community",
                                 "certificate_number", "issue_date", "issuing_authority",
                                 "district", "state"],
        "income_certificate":   ["name", "father_name", "annual_income", "income_source",
                                 "certificate_number", "issue_date", "issuing_authority",
                                 "district", "state"],
        "land_document":        ["owner_name", "survey_number", "plot_number", "area",
                                 "location", "district", "taluk", "village",
                                 "registration_number", "registration_date",
                                 "property_value", "sub_registrar_office"],
        "birth_certificate":    ["child_name", "dob", "place_of_birth", "father_name",
                                 "mother_name", "registration_number", "issuing_authority"],
        "domicile_certificate": ["name", "father_name", "dob", "address",
                                 "resident_since", "certificate_number",
                                 "issue_date", "issuing_authority"],
    }

    FIELD_HINTS = {
        "aadhaar_number":    "12-digit number formatted as 'XXXX XXXX XXXX'",
        "pan_number":        "10-char alphanumeric like 'ABCDE1234F' (always uppercase)",
        "passport_number":   "1 letter + 7 digits like 'A1234567'",
        "dl_number":         "State code + digits like 'MH12 20190012345'",
        "voter_id_number":   "3 letters + 7 digits like 'ABC1234567'",
        "dob":               "DD/MM/YYYY format",
        "expiry_date":       "DD/MM/YYYY format",
        "issue_date":        "DD/MM/YYYY format",
        "registration_date": "DD/MM/YYYY format",
        "pincode":           "6-digit number",
        "annual_income":     "numeric value in INR, e.g. '120000'",
    }

    def extract_fields(self, text: str, document_type: str) -> List[Dict[str, Any]]:
        if not text or len(text.strip()) < 5:
            return [{"field_name": "error", "field_value": None, "confidence_score": 0,
                     "is_valid": False, "validation_message": "No text extracted"}]

        fields = self.DOCUMENT_FIELDS.get(document_type, ["name", "dob", "id_number", "address"])

        try:
            result = self._extract_with_ai(text, document_type, fields)
            if result:
                logger.info(f"AI extracted {len(result)} fields for {document_type}")
                # Add overall validity verdict at the end
                verdict = self._compute_verdict(result, document_type)
                result.append(verdict)
                return result
        except Exception as e:
            logger.warning(f"AI extraction failed, falling back to regex: {e}")

        result = self._extract_with_regex(text, document_type, fields)
        verdict = self._compute_verdict(result, document_type)
        result.append(verdict)
        return result

    # ── Verdict Computation ───────────────────────────────────────────────────

    def _compute_verdict(self, fields: List[Dict], document_type: str) -> Dict:
        """
        Computes overall document validity verdict.
        Returns: VALID, SUSPICIOUS, or INVALID
        """
        total = [f for f in fields if f.get("field_name") != "error"]
        if not total:
            return {
                "field_name": "__verdict__",
                "field_value": "INVALID",
                "confidence_score": 0,
                "is_valid": False,
                "validation_message": "No fields could be extracted from this document.",
                "verdict_color": "red",
                "verdict_icon": "❌"
            }

        valid_fields = [f for f in total if f.get("is_valid")]
        found_fields = [f for f in total if f.get("field_value") not in (None, "", "null", "None", "N/A")]
        avg_confidence = sum(f.get("confidence_score", 0) for f in total) / len(total)

        valid_ratio = len(valid_fields) / len(total)
        found_ratio = len(found_fields) / len(total)

        # Key fields that MUST be present for a document to be valid
        key_field_map = {
            "aadhaar":           "aadhaar_number",
            "pan":               "pan_number",
            "passport":          "passport_number",
            "driving_license":   "dl_number",
            "voter_id":          "voter_id_number",
            "ration_card":       "ration_card_number",
            "income_certificate":"certificate_number",
            "caste_certificate": "certificate_number",
            "birth_certificate": "registration_number",
            "land_document":     "registration_number",
            "domicile_certificate": "certificate_number",
        }

        key_field = key_field_map.get(document_type)
        key_field_valid = True
        if key_field:
            key = next((f for f in total if f["field_name"] == key_field), None)
            key_field_valid = key and key.get("is_valid", False)

        # Determine verdict
        if valid_ratio >= 0.65 and avg_confidence >= 70 and key_field_valid and found_ratio >= 0.6:
            verdict = "VALID"
            color = "green"
            icon = "✅"
            msg = (f"Document appears genuine. {len(valid_fields)}/{len(total)} fields validated "
                   f"with {avg_confidence:.0f}% average confidence.")
        elif valid_ratio >= 0.4 or avg_confidence >= 50:
            verdict = "SUSPICIOUS"
            color = "yellow"
            icon = "⚠️"
            issues = []
            if not key_field_valid and key_field:
                issues.append(f"key ID field '{key_field}' is missing or invalid")
            if avg_confidence < 60:
                issues.append("low confidence extraction")
            if found_ratio < 0.5:
                issues.append("many fields not found")
            msg = (f"Document requires manual review. Issues: {', '.join(issues) if issues else 'partial data extracted'}. "
                   f"{len(valid_fields)}/{len(total)} fields validated.")
        else:
            verdict = "INVALID"
            color = "red"
            icon = "❌"
            msg = (f"Document failed validation. Only {len(valid_fields)}/{len(total)} fields valid "
                   f"with {avg_confidence:.0f}% confidence. Manual verification required.")

        return {
            "field_name": "__verdict__",
            "field_value": verdict,
            "confidence_score": round(avg_confidence, 1),
            "is_valid": verdict == "VALID",
            "validation_message": msg,
            "verdict_color": color,
            "verdict_icon": icon,
        }

    # ── AI Extraction ─────────────────────────────────────────────────────────

    def _extract_with_ai(self, text: str, document_type: str, fields: List[str]) -> List[Dict]:
        hints = "\n".join(
            f"  - {f}: {self.FIELD_HINTS[f]}" for f in fields if f in self.FIELD_HINTS
        )

        prompt = f"""You are an expert document parser for Indian government documents.
The document may be in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, or any Indian regional language.

Document type: {document_type}
Extract these fields: {', '.join(fields)}

Field format hints:
{hints if hints else '  (none)'}

Document text:
\"\"\"
{text[:3500]}
\"\"\"

Rules:
- Return ALL requested fields — use null if not found
- confidence_score: 0-100 (how certain you are)
- Translate field values to English if in regional language, keep proper nouns (names, places) as-is
- For Telugu/Hindi/Tamil documents: extract values from regional script and transliterate names to English
- Be precise — extract exactly what is printed, no guessing

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {{"field_name": "name", "field_value": "Ramesh Kumar", "confidence_score": 95}},
  {{"field_name": "dob", "field_value": "15/08/1990", "confidence_score": 90}}
]"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1500,
        )

        raw = re.sub(r"```json|```", "", response.choices[0].message.content).strip()
        parsed = json.loads(raw)

        result = []
        for item in parsed:
            fn = item.get("field_name")
            fv = item.get("field_value")
            conf = float(item.get("confidence_score", 0))
            is_valid, msg = self._validate_field(fn, fv)
            result.append({
                "field_name": fn,
                "field_value": fv,
                "confidence_score": conf,
                "is_valid": is_valid,
                "validation_message": msg,
            })
        return result

    # ── Regex Fallback ────────────────────────────────────────────────────────

    def _extract_with_regex(self, text: str, document_type: str, fields: List[str]) -> List[Dict]:
        PATTERNS = {
            "aadhaar_number":     r"\b\d{4}\s?\d{4}\s?\d{4}\b",
            "pan_number":         r"\b[A-Z]{5}\d{4}[A-Z]\b",
            "passport_number":    r"\b[A-Z]\d{7}\b",
            "dl_number":          r"\b[A-Z]{2}[\s\-]?\d{2}[\s\-]?\d{4}[\s\-]?\d{7}\b",
            "voter_id_number":    r"\b[A-Z]{3}\d{7}\b",
            "ration_card_number": r"\b\d{10,16}\b",
            "certificate_number": r"(?:cert(?:ificate)?[\s\#\.no:]+)([\w\/\-]+)",
            "registration_number":r"(?:reg(?:istration)?[\s\#\.no:]+)([\w\/\-]+)",
            "dob":                r"\b\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}\b",
            "expiry_date":        r"(?:expir|valid till|valid upto|validity)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
            "issue_date":         r"(?:issue|issued|date of issue)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
            "registration_date":  r"(?:registration date|date of reg)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
            "pincode":            r"\b[1-9]\d{5}\b",
            "annual_income":      r"(?:annual income|income|వార్షిక ఆదాయం|वार्षिक आय|வருடாந்திர வருமானம்)[:\s₹Rs\.]+(\d[\d,]+)",
            "property_value":     r"(?:value|consideration|market value)[:\s₹Rs\.]+(\d[\d,]+)",
            "area":               r"(?:area|extent)[:\s]+([\d\.]+\s*(?:sq\.?\s*mt|sq\.?\s*ft|acre|guntha|cent|hectare))",
        }

        results = []
        for field in fields:
            value = None
            confidence = 0

            pattern = PATTERNS.get(field)
            if pattern:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = (match.group(1) if match.lastindex else match.group(0)).strip()
                    confidence = 65

            if not value and "name" in field:
                for line in text.split('\n')[:10]:
                    words = line.strip().split()
                    if 2 <= len(words) <= 5 and all(w.replace('.', '').replace("'", '').isalpha() for w in words):
                        value = line.strip()
                        confidence = 45
                        break

            if not value and field in ("address", "location"):
                addr_kw = ["road", "street", "nagar", "colony", "sector", "village", "district",
                           "taluk", "mandal", "post", "pin", "near", "house no"]
                for line in text.split('\n'):
                    if any(k in line.lower() for k in addr_kw):
                        value = line.strip()
                        confidence = 40
                        break

            is_valid, msg = self._validate_field(field, value)
            results.append({
                "field_name": field, "field_value": value,
                "confidence_score": confidence, "is_valid": is_valid,
                "validation_message": msg,
            })
        return results

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate_field(self, field_name: str, value: Any) -> tuple:
        if not value or str(value).strip() in ("", "null", "None", "N/A"):
            return False, "Field not found"
        v = str(value).strip()

        validators = {
            "aadhaar_number":    lambda x: len(re.sub(r"\D", "", x)) == 12,
            "pan_number":        lambda x: bool(re.match(r"^[A-Z]{5}\d{4}[A-Z]$", x)),
            "passport_number":   lambda x: bool(re.match(r"^[A-Z]\d{7}$", x)),
            "voter_id_number":   lambda x: bool(re.match(r"^[A-Z]{3}\d{7}$", x)),
            "dob":               lambda x: bool(re.search(r"\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}", x)),
            "expiry_date":       lambda x: bool(re.search(r"\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}", x)),
            "issue_date":        lambda x: bool(re.search(r"\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}", x)),
            "registration_date": lambda x: bool(re.search(r"\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}", x)),
            "pincode":           lambda x: bool(re.match(r"^[1-9]\d{5}$", re.sub(r"\D", "", x))),
            "annual_income":     lambda x: bool(re.search(r"\d+", x)),
        }

        validator = validators.get(field_name)
        if validator:
            ok = validator(v)
            return ok, "Valid" if ok else f"Invalid {field_name.replace('_', ' ')} format"

        return len(v) >= 2, "Valid" if len(v) >= 2 else "Value too short"