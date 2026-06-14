# Demo Readiness Report

## Working Features
- **Olist Ingestion Pipeline**: Successfully ingests customers, orders, items, payments, reviews, and products. Correctly converts BRL to INR dynamically at a 15x rate.
- **RFM Engine & Segmentation**: Accurately computes Recency, Frequency, Monetary Score, and Churn Risk. Prebuilt segments (High Value, Churn Risk, etc.) are generated automatically.
- **Campaign Creation Flow**: Users can successfully create campaigns and target prebuilt segments.
- **Background Dispatcher**: Campaigns launch immediately in the UI while a background thread generates Communication records.
- **Channel Simulator Integration**: The FastAPI simulator processes dispatch events and returns callback receipts (Delivered, Opened, Clicked, Failed) successfully to the Django backend.
- **Analytics Aggregations**: The dashboard stats and conversion funnels correctly tally live real-time data from the backend database APIs.
- **Frontend/Backend Integration**: The React frontend (TanStack Router + Query) seamlessly consumes the live Django DRF endpoints.

## Broken Features
- None within the MVP scope! 
- *Note: The OpenAI / AI Orchestration features (AudienceBuilderService and CampaignCopilotService) remain stubbed as requested to avoid unconfigured external dependencies.*

## Fixes Applied
1. **Missing Model Attribute in Dispatcher**: Fixed a bug where `CampaignDispatcherService` attempted to read `campaign.draft_message` instead of the correct model field `campaign.message`.
2. **Channel Simulator Callback Resolution**: Fixed a routing issue where the `http://crm:8000/` docker-compose alias could not be resolved on local execution. The simulator must be started with `CRM_RECEIPT_CALLBACK_URL="http://127.0.0.1:8000/api/communications/receipts/"`.
3. **URL Routing Collision**: Fixed a Django URL collision where `communications/receipts/` was mistakenly being caught by `CommunicationViewSet(detail=True)` regex instead of `CommunicationReceiptView`. Moved the static path higher in `urls.py`.
4. **Encoding Issues on Windows**: Ingestion script emojis caused a `UnicodeEncodeError`. Fixed by using `PYTHONIOENCODING=utf-8` on execution.

---

## Commands To Start System

**Backend (Django API)**
```powershell
cd backend
py -m pip install -r requirements.txt
py manage.py migrate
py manage.py runserver 8000
```

**Simulator (FastAPI)**
```powershell
cd channel_simulator
py -m pip install -r requirements.txt
$env:CRM_RECEIPT_CALLBACK_URL="http://127.0.0.1:8000/api/communications/receipts/"
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

**Frontend (React/Vite)**
```powershell
npm install
npm run dev
```

---

## End-to-End Demo Procedure

1. **Reset Database (Optional)**: If you want a clean slate, delete `backend/db.sqlite3` and run `py manage.py migrate`.
2. **Ingest Data**: Execute the data pipeline:
   ```powershell
   cd backend
   $env:PYTHONIOENCODING="utf-8"
   py manage.py ingest_olist --data-dir <path-to-olist-csv-folder>
   py manage.py rfm_compute
   py manage.py build_segments
   ```
3. **Start Servers**: Run the three servers as detailed in the "Commands To Start System" section above.
4. **Navigate to App**: Open `http://localhost:5173` in your browser.
5. **View Real Data**: Notice the Dashboard KPI cards reflect the actual ingested data.
6. **Check Customers**: Go to the "Customers" tab and click any customer to view their RFM score and previous purchases.
7. **Create Campaign**: Go to the "Campaigns" tab, click "Create Campaign", and fill in the details targeting a prebuilt segment (like "Churn Risk").
8. **Launch Campaign**: Open the created Draft campaign and click "Launch".
9. **Watch Simulator Callbacks**: Keep the simulator terminal open. You will see it accept the job and generate delayed webhook requests. Refresh the Campaign detail page in the UI to see the Funnel stats update in real time as "Delivered" and "Opened" callbacks stream in!
10. **View Analytics**: Go to the "Analytics" tab to see system-wide aggregations.

---

# OVERALL STATUS:
READY FOR DEMO
