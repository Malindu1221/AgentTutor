from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import orchestrator
from auth import get_optional_current_user, router as auth_router
from personal_mongo import router as profile_router

app = FastAPI(title="AgentTutor API", version="1.0")

# Configure CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(profile_router)

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
def api_start_session(
    req: StartSessionRequest,
    current_user: dict[str, str] | None = Depends(get_optional_current_user),
):
    """Triggers Phase 1: Assessment and MCQ Generation"""
    user_id = current_user["id"] if current_user else "guest"
    res = orchestrator.start_session(req.query, user_id)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.post("/submit_answers")
def api_submit_answers(
    req: SubmitAnswersRequest,
    current_user: dict[str, str] | None = Depends(get_optional_current_user),
):
    """Triggers Phase 2: Evaluation, Roadmap, and Content Recommendations"""
    user_id = current_user["id"] if current_user else "guest"
    res = orchestrator.submit_answers(req.session_id, req.answers, user_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res