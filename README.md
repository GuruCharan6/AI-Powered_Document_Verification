# 🛡️ AI-Powered Document Verification Platform

An intelligent document verification system that uses AI to authenticate, extract, classify, and analyze documents with fraud detection capabilities.

---

## 🚀 Features

- 🔐 **User Authentication** — Secure login and signup with JWT-based auth
- 📄 **Document Upload & Storage** — Upload documents securely via Supabase Storage
- 🤖 **AI Classification** — Automatically classifies document types
- 🔍 **OCR Extraction** — Extracts text and key fields from documents
- 🧠 **Fraud Detection** — Detects potentially fraudulent or tampered documents
- 💡 **AI Explainer** — Uses GROQ (LLaMA 3.3) to explain verification results in plain language
- 📊 **Dashboard** — View all uploaded documents and their verification status
- 📋 **Audit Logs** — Track all document verification activity
- 🌗 **Dark/Light Theme** — Toggle between themes

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
│   │   │   ├── classification_service.py
│   │   │   ├── explainer_service.py
│   │   │   ├── extraction_service.py
│   │   │   ├── fraud_service.py
│   │   │   ├── ocr_service.py
│   │   │   └── visual_service.py
│   │   └── utils/
│   │       ├── image_processing.py
│   │       └── validators.py
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── config.py
│   ├── auth.py
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

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Database & Storage | Supabase (PostgreSQL + Storage) |
| AI Explainer | GROQ API (LLaMA 3.3 70B) |
| Authentication | JWT (JSON Web Tokens) |
| OCR | Python OCR Service |

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.9+
- Node.js 18+
- A Supabase account
- A GROQ API key

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
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# JWT
SECRET_KEY=your_strong_random_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Storage
STORAGE_BUCKET=documents

# Explainer API
GROQ_API_KEY=your_groq_api_key
```

Run the backend:

```bash
python -m uvicorn app.main:app --reload
```

Backend will be running at: `http://localhost:8000`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will be running at: `http://localhost:5173`

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SECRET_KEY` | Secret key for JWT token signing |
| `ALGORITHM` | JWT algorithm (HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry duration |
| `STORAGE_BUCKET` | Supabase storage bucket name |
| `GROQ_API_KEY` | GROQ API key for AI explainer |

---

## 📸 Screenshots

> _Add screenshots of your Dashboard, Document Verification, and Audit Logs pages here._
<img width="1897" height="866" alt="Screenshot 2026-03-02 015242" src="https://github.com/user-attachments/assets/56fc3af4-2ac4-480b-8232-f10f3bf6e581" />
<img width="1898" height="866" alt="Screenshot 2026-03-02 015308" src="https://github.com/user-attachments/assets/b74331c4-2dc4-4d5a-ac16-2b913898918d" />

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 👨‍💻 Author

**GuruCharan6** — [GitHub Profile](https://github.com/GuruCharan6)
