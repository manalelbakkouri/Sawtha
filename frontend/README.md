# Tbibti MVP Starter

A hackathon-ready MVP for **Tbibti — Rural Maternal Care Coordination AI**.

## Run backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Replace seed data with your generated dataset

Put your JSON files in `backend/app/data/`.

Supported core files:
- patients.json
- care_plans.json
- trusted_people.json
- medical_staff.json
- alerts.json
- checkins_history.json
- generated_reports.json

## MVP flow

Patient transcript → RuralCareOrchestrator → Darija extraction → Risk engine → Rural scoring → Doctor report → Family alert.
