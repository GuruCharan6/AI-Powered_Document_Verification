# 🛡️ AI-Powered Document Verification Platform

<div align="center">

![Banner](https://img.shields.io/badge/AI--Powered-Document%20Verification-blue?style=for-the-badge&logo=shield&logoColor=white)

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-Visit%20Website-brightgreen?style=for-the-badge)](https://ai-powered-document-verification.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-GuruCharan6-black?style=for-the-badge&logo=github)](https://github.com/GuruCharan6/AI-Powered_Document_Verification)


**An intelligent platform that authenticates, classifies, extracts, and fraud-checks Indian government documents using AI — supporting 20+ document types across all regional languages.**

[🌐 Live Demo](https://ai-powered-document-verification.vercel.app/) · [🐛 Report Bug](https://github.com/GuruCharan6/AI-Powered_Document_Verification/issues) · [✨ Request Feature](https://github.com/GuruCharan6/AI-Powered_Document_Verification/issues)

</div>

---

## 📸 Screenshots

<img width="1897" alt="Dashboard" src="https://github.com/user-attachments/assets/56fc3af4-2ac4-480b-8232-f10f3bf6e581" />
<img width="1898" alt="Document Verification" src="https://github.com/user-attachments/assets/b74331c4-2dc4-4d5a-ac16-2b913898918d" />

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | Secure signup/login with JWT-based auth |
| 📄 **Document Upload** | Upload images and PDFs securely via Supabase Storage |
| 🤖 **AI Classification** | Automatically identifies 20+ Indian government document types |
| 🔍 **OCR Extraction** | Extracts all key fields using PaddleOCR + Tesseract multilingual pipeline |
| 🌐 **Regional Language Support** | Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Marathi and more |
| 🧠 **Fraud Detection** | Detects tampering, editing software, duplicates, and copy-paste forgery |
| 💡 **AI Explainer** | LLaMA 3.3 70B explains verification results in plain language |
| ✅ **Verdict System** | Clear APPROVED / REVIEW / REJECTED — FAKE verdict per document |
| 📊 **Dashboard** | View all uploaded documents and their verification status at a glance |
| 📋 **Audit Logs** | Full activity trail for every document verification |
| 🌗 **Dark / Light Theme** | Toggle between themes |

---

## 📄 Supported Document Types

<details>
<summary>Click to expand — 20+ document types supported</summary>

**Identity**
- Aadhaar Card, PAN Card, Passport, Driving Licence, Voter ID (EPIC)

**Certificates**
- Ration Card, Caste Certificate, Income Certificate, Domicile Certificate
- Birth, Death & Marriage Certificate

**Land & Property**
- Sale Deed, Patta, Encumbrance Certificate, 7/12, Khatauni, Jamabandi, Form 6A

**Education & Employment**
- Degree Certificate, Transfer Certificate, Migration Certificate
- Employee ID, NREGA Job Card

</details>

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Database & Storage | Supabase (PostgreSQL + Storage) |
| AI / LLM | Groq API — LLaMA 3.3 70B Versatile |
| OCR | PaddleOCR (multilingual) + Tesseract |
| Image Processing | OpenCV, NumPy, Pillow |
| PDF Support | PyMuPDF (fitz) |
| Authentication | JWT (JSON Web Tokens) |
| Deployment | Vercel (frontend) · Render (backend) |

---

## 🗂️ Project Structure

```
AI-Powered_Document_Verification/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── dashboard.py
│   │   │   └── documents.py
│   │   ├── services/
│   │   │   ├── classification_service.py  ← AI document classifier
│   │   │   ├── explainer_service.py       ← LLaMA verdict explainer
│   │   │   ├── extraction_service.py      ← Field extractor + validator
│   │   │   ├── fraud_service.py           ← Fraud & tampering detection
│   │   │   ├── ocr_service.py             ← PaddleOCR + Tesseract pipeline
│   │   │   └── visual_service.py          ← Stamp/seal/signature detector
│   │   └── utils/
│   │       ├── image_processing.py
│   │       └── validators.py
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── database.py
│   │   ├── config.py
│   │   └── auth.py
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.jsx
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   ├── VerifyDoc.jsx
    │   │   ├── DocumentDetailPanel.jsx
    │   │   ├── ExtractedDetails.jsx
    │   │   ├── AuditLogs.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── Header.jsx
    │   │   └── ProtectedRoute.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── ThemeContext.jsx
    │   ├── hooks/
    │   │   ├── useDocuments.js
    │   │   └── useDocumentDetail.js
    │   └── services/
    │       └── api.js
    └── package.json
```

---

## ⚙️ Local Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- Supabase account → [supabase.com](https://supabase.com)
- Groq API key → [console.groq.com](https://console.groq.com)

---

### 1. Clone the Repository

```bash
git clone https://github.com/GuruCharan6/AI-Powered_Document_Verification.git
cd AI-Powered_Document_Verification
```

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# JWT
SECRET_KEY=your_strong_random_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Storage
STORAGE_BUCKET=documents

# AI
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

Backend runs at → `http://localhost:8000`
API docs at → `http://localhost:8000/docs`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at → `http://localhost:5173`

---

## 🔑 Environment Variables Reference

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SECRET_KEY` | Secret key for JWT signing |
| `ALGORITHM` | JWT algorithm — `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry in minutes |
| `STORAGE_BUCKET` | Supabase storage bucket name |
| `GROQ_API_KEY` | Groq API key for LLM calls |
| `GROQ_MODEL` | Model name — `llama-3.3-70b-versatile` |

---

## 🚀 Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | [ai-powered-document-verification.vercel.app](https://ai-powered-document-verification.vercel.app/) |
| Backend | Render | Auto-deployed from `main` branch |

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch → `git checkout -b feature/your-feature`
3. Commit your changes → `git commit -m "Add your feature"`
4. Push to your branch → `git push origin feature/your-feature`
5. Open a Pull Request

For major changes, please open an issue first to discuss what you'd like to change.

---

## 👨‍💻 Author

**GuruCharan6**

[![GitHub](https://img.shields.io/badge/GitHub-GuruCharan6-black?style=flat-square&logo=github)](https://github.com/GuruCharan6)

---

<div align="center">
  <sub>Built with ❤️ for Indian document verification</sub>
</div>
