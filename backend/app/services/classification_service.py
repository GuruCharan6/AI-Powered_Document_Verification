import re
import json
import logging
from typing import Dict, Any, List
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)


class DocumentClassifier:
    """AI-powered classifier for all Indian government documents including regional language docs"""

    DOCUMENT_TYPES = {
        # ── Identity Documents ────────────────────────────────────────────────
        "aadhaar": {
            "keywords": ["aadhaar", "uidai", "unique identification", "आधार", "ஆதார்", "ఆధార్", "ಆಧಾರ್", "আধার"],
            "regex_patterns": [r"\d{4}\s\d{4}\s\d{4}", r"\b\d{12}\b"],
            "fields": ["name", "dob", "gender", "aadhaar_number", "address", "pincode"],
        },
        "pan": {
            "keywords": ["permanent account number", "income tax", "pan", "पैन", "பான்"],
            "regex_patterns": [r"\b[A-Z]{5}\d{4}[A-Z]\b"],
            "fields": ["name", "father_name", "dob", "pan_number"],
        },
        "passport": {
            "keywords": ["passport", "republic of india", "ministry of external affairs", "पासपोर्ट", "P<IND"],
            "regex_patterns": [r"\b[A-Z]\d{7}\b", r"P<IND"],
            "fields": ["name", "passport_number", "dob", "place_of_birth", "expiry_date", "nationality", "issue_date"],
        },
        "driving_license": {
            "keywords": ["driving licence", "driving license", "dl no", "transport department",
                         "ड्राइविंग लाइसेंस", "ஓட்டுநர் உரிமம்", "డ్రైవింగ్ లైసెన్స్"],
            "regex_patterns": [r"\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}\b", r"\b[A-Z]{2}-\d{2}-\d{4}-\d{7}\b"],
            "fields": ["name", "dob", "dl_number", "address", "issue_date", "expiry_date", "vehicle_class"],
        },
        "voter_id": {
            "keywords": ["election commission", "voter", "epic", "elector", "मतदाता",
                         "வாக்காளர்", "ఓటరు గుర్తింపు", "ಮತದಾರರ ಗುರುತಿನ"],
            "regex_patterns": [r"\b[A-Z]{3}\d{7}\b"],
            "fields": ["name", "father_name", "dob", "voter_id_number", "address", "part_number"],
        },

        # ── Certificate Documents ─────────────────────────────────────────────
        "ration_card": {
            "keywords": ["ration card", "fair price", "nfsa", "राशन कार्ड", "ration", "civil supplies",
                         "ரேஷன் அட்டை", "రేషన్ కార్డు", "ಪಡಿತರ ಚೀಟಿ", "রেশন কার্ড"],
            "regex_patterns": [r"\bAPL\b", r"\bBPL\b", r"\bAAY\b", r"\bPHH\b"],
            "fields": ["head_of_family", "ration_card_number", "card_type", "address",
                       "family_members", "district", "state", "issued_date"],
        },
        "caste_certificate": {
            "keywords": ["caste certificate", "community certificate", "जाति प्रमाण पत्र",
                         "சாதி சான்றிதழ்", "కుల ధృవీకరణ పత్రం", "ಜಾತಿ ಪ್ರಮಾಣ ಪತ್ರ",
                         "scheduled caste", "scheduled tribe", "obc", "other backward class",
                         "अनुसूचित जाति", "अनुसूचित जनजाति", "पिछड़ा वर्ग"],
            "regex_patterns": [r"\bSC\b", r"\bST\b", r"\bOBC\b", r"\bEWS\b"],
            "fields": ["name", "father_name", "caste", "sub_caste", "community",
                       "certificate_number", "issue_date", "issuing_authority", "district", "state"],
        },
        "income_certificate": {
            "keywords": ["income certificate", "आय प्रमाण पत्र", "வருமான சான்றிதழ்",
                         "ఆదాయ ధృవీకరణ పత్రం", "ಆದಾಯ ಪ್ರಮಾಣ ಪತ್ರ", "annual income",
                         "वार्षिक आय", "income proof", "family income"],
            "regex_patterns": [r"₹\s?\d+[\d,]*", r"Rs\.?\s?\d+[\d,]*"],
            "fields": ["name", "father_name", "annual_income", "income_source",
                       "certificate_number", "issue_date", "issuing_authority", "district", "state"],
        },
        "land_document": {
            "keywords": ["patta", "sale deed", "registry", "khata", "khasra", "khatauni",
                         "7/12", "rtu", "jamabandi", "fard", "pattedar", "survey number",
                         "पट्टा", "खसरा", "खतौनी", "भूमि", "जमीन", "रजिस्ट्री",
                         "பட்டா", "भूमि स्वामित्व", "land record", "property document",
                         "sub registrar", "encumbrance certificate", "ec"],
            "regex_patterns": [r"\bsurvey\s*no\b", r"\bkhata\s*no\b", r"\bplot\s*no\b"],
            "fields": ["owner_name", "survey_number", "plot_number", "area", "location",
                       "district", "taluk", "village", "registration_number",
                       "registration_date", "property_value", "sub_registrar_office"],
        },
        "birth_certificate": {
            "keywords": ["birth certificate", "date of birth", "जन्म प्रमाण पत्र",
                         "பிறப்பு சான்றிதழ்", "జన్మ ధృవీకరణ పత్రం", "registration of birth",
                         "municipal corporation", "gram panchayat"],
            "regex_patterns": [r"\bregistration\s*no\b"],
            "fields": ["child_name", "dob", "place_of_birth", "father_name",
                       "mother_name", "registration_number", "issuing_authority"],
        },
        "domicile_certificate": {
            "keywords": ["domicile", "residence certificate", "निवास प्रमाण पत्र",
                         "bonafide resident", "permanent resident", "स्थायी निवासी"],
            "regex_patterns": [],
            "fields": ["name", "father_name", "dob", "address", "resident_since",
                       "certificate_number", "issue_date", "issuing_authority"],
        },
    }

    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    def classify(self, text: str) -> Dict[str, Any]:
        if not text or len(text.strip()) < 10:
            return {"document_type": "unknown", "confidence": 0, "expected_fields": [],
                    "pattern_matches": [], "message": "Insufficient text"}

        result = self._classify_with_regex(text)

        # If low confidence, use AI for better accuracy
        if result["confidence"] < 50:
            try:
                ai_result = self._classify_with_ai(text)
                if ai_result["confidence"] > result["confidence"]:
                    result = ai_result
                    logger.info(f"AI classification: {ai_result['document_type']} ({ai_result['confidence']}%)")
            except Exception as e:
                logger.warning(f"AI classification failed, using regex result: {e}")

        return result

    def _classify_with_regex(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        scores = {}

        for doc_type, patterns in self.DOCUMENT_TYPES.items():
            score = 0
            matches = []

            for keyword in patterns["keywords"]:
                if keyword.lower() in text_lower:
                    score += 15
                    matches.append(f"keyword:{keyword}")

            for pattern in patterns["regex_patterns"]:
                found = re.findall(pattern, text, re.IGNORECASE)
                if found:
                    score += 35
                    matches.extend([str(f) for f in found[:3]])

            scores[doc_type] = {"score": score, "matches": matches}

        best_type, best_data = max(scores.items(), key=lambda x: x[1]["score"])
        confidence = min(best_data["score"], 100)

        if best_data["score"] < 20:
            best_type = "unknown"
            confidence = best_data["score"]

        return {
            "document_type": best_type,
            "confidence": round(confidence, 2),
            "expected_fields": self.DOCUMENT_TYPES.get(best_type, {}).get("fields", []),
            "pattern_matches": best_data["matches"],
        }

    def _classify_with_ai(self, text: str) -> Dict[str, Any]:
        doc_types = list(self.DOCUMENT_TYPES.keys())
        prompt = f"""You are an expert in Indian government documents across all states and regional languages.

Classify the following document text into one of these types:
{', '.join(doc_types)}, or unknown

The document may be in English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, or any other Indian language.

Document text:
\"\"\"{text[:1500]}\"\"\"

Return ONLY valid JSON (no markdown):
{{"document_type": "aadhaar", "confidence": 92, "language": "Hindi", "reasoning": "Contains आधार and 12-digit UID"}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=200,
        )
        raw = re.sub(r"```json|```", "", response.choices[0].message.content).strip()
        data = json.loads(raw)
        doc_type = data.get("document_type", "unknown")

        return {
            "document_type": doc_type,
            "confidence": float(data.get("confidence", 50)),
            "expected_fields": self.DOCUMENT_TYPES.get(doc_type, {}).get("fields", []),
            "pattern_matches": [data.get("reasoning", "")],
            "detected_language": data.get("language", "unknown"),
        }

    def get_field_patterns(self, doc_type: str) -> Dict[str, Any]:
        """Legacy compatibility"""
        return {
            "name": {"regex": r"(?:name|नाम|பெயர்|పేరు)[:\s]+([A-Za-z\s\.]+)", "keywords": ["name", "नाम"]},
            "dob": {"regex": r"(?:dob|date of birth|जन्म)[:\s]+(\d{2}[/-]\d{2}[/-]\d{4})", "keywords": ["dob", "birth"]},
            "aadhaar_number": {"regex": r"(\d{4}\s\d{4}\s\d{4})", "keywords": ["aadhaar"]},
            "pan_number": {"regex": r"([A-Z]{5}\d{4}[A-Z])", "keywords": ["pan"]},
            "address": {"regex": r"(?:address|पता|முகவரி)[:\s]+(.+?)(?:\n|\d{6}|$)", "keywords": ["address"]},
        }