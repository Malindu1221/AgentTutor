from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import orchestrator

app = FastAPI(title="AgentTutor API", version="1.0")

# Configure CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class StartSessionRequest(BaseModel):
    query: str
    user_id: str = "guest"

class SubmitAnswersRequest(BaseModel):
    session_id: str
    answers: dict

@app.get("/")
def health_check():
    return {"status": "AgentTutor API is running"}

@app.post("/start_session")
def api_start_session(req: StartSessionRequest):
    """Triggers Phase 1: Assessment and MCQ Generation"""
    res = orchestrator.start_session(req.query, req.user_id)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.post("/submit_answers")
def api_submit_answers(req: SubmitAnswersRequest):
    """Triggers Phase 2: Evaluation, Roadmap, and Content Recommendations"""
    res = orchestrator.submit_answers(req.session_id, req.answers)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res