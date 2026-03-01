import logging
from typing import Dict, Any
from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)


class ExplainerService:
    """Groq-powered document verification explainer"""

    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    async def explain_validation(self, document_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            fields        = document_data.get("fields", [])
            fraud_checks  = document_data.get("fraud_checks", [])
            doc_type      = document_data.get("document_type", "unknown")
            scores        = document_data.get("confidence_scores", {})
            overall_conf  = scores.get("overall", 0)

            valid_fields      = [f for f in fields if f.get("is_valid")]
            invalid_fields    = [f for f in fields if not f.get("is_valid")]
            suspicious_checks = [c for c in fraud_checks if c.get("is_suspicious")]

            # Build detailed field summary
            field_summary = "\n".join(
                f"  {'✓' if f['is_valid'] else '✗'} {f['field_name']}: "
                f"{f.get('field_value', 'NOT FOUND')} "
                f"(confidence: {f.get('confidence_score', 0)}%)"
                for f in fields
            )

            fraud_summary = "\n".join(
                f"  {'⚠' if c['is_suspicious'] else '✓'} {c['check_type']}: "
                f"risk score {c.get('risk_score', 0)}"
                for c in fraud_checks
            ) or "  No fraud checks run"

            prompt = f"""You are a senior document verification officer for Indian government documents.

Document Type: {doc_type.replace('_', ' ').title()}
Overall Confidence: {overall_conf}%

Extracted Fields:
{field_summary or '  None'}

Fraud Detection Results:
{fraud_summary}

Write a clear professional verification report (4-5 sentences) that:
1. States the document type and overall authenticity assessment
2. Highlights which key fields were successfully extracted vs missing
3. Mentions any fraud or quality concerns
4. Gives a clear recommendation: APPROVE, REVIEW, or REJECT with reason

Keep it concise and factual. Suitable for a government officer to read."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional government document verification officer. Be concise, factual, and clear."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=500,
            )

            explanation = response.choices[0].message.content.strip()

            # Auto-determine verdict
            verdict = self._determine_verdict(valid_fields, invalid_fields, suspicious_checks, overall_conf)

            return {
                "explanation": explanation,
                "verdict": verdict,
                "valid_fields_count": len(valid_fields),
                "invalid_fields_count": len(invalid_fields),
                "suspicious_checks_count": len(suspicious_checks),
                "overall_confidence": overall_conf,
                "model_used": self.model,
            }

        except Exception as e:
            logger.error(f"Explainer failed: {e}")
            return {
                "explanation": self._fallback_explanation(document_data),
                "verdict": "REVIEW",
                "error": str(e),
            }

    def _determine_verdict(self, valid, invalid, suspicious, confidence) -> str:
        if len(suspicious) >= 2 or confidence < 35:
            return "REJECT"
        if len(suspicious) >= 1 or len(invalid) > len(valid) or confidence < 60:
            return "REVIEW"
        return "APPROVE"

    def _fallback_explanation(self, data: Dict[str, Any]) -> str:
        fields = data.get("fields", [])
        fraud  = data.get("fraud_checks", [])
        valid  = [f for f in fields if f.get("is_valid")]
        invalid = [f for f in fields if not f.get("is_valid")]
        suspicious = [c for c in fraud if c.get("is_suspicious")]

        lines = []
        if valid:
            lines.append(f"✓ {len(valid)} field(s) validated: {', '.join(f['field_name'] for f in valid)}.")
        if invalid:
            lines.append(f"✗ {len(invalid)} field(s) missing: {', '.join(f['field_name'] for f in invalid)}.")
        if suspicious:
            lines.append(f"⚠ Suspicious: {', '.join(c['check_type'] for c in suspicious)}.")
        else:
            lines.append("✓ No fraud indicators detected.")
        lines.append("Recommendation: REVIEW manually before approval.")
        return " ".join(lines)