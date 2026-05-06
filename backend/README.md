## Backend (FastAPI)

### Setup
In PowerShell:

```powershell
cd "C:\Users\ranaw\Documents\Research_Project\R26-IT-084\backend"
..\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Run
Make sure `waste_classification_model.h5` exists in `R26-IT-084\backend\` **or** set `WASTE_MODEL_PATH`.

```powershell
cd "C:\Users\ranaw\Documents\Research_Project\R26-IT-084\backend"
..\venv\Scripts\Activate.ps1
$env:WASTE_MODEL_PATH = "..\waste_classification_model.h5"
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Health check at `http://127.0.0.1:8000/health`
