from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import orchestrator
from auth import get_optional_current_user, router as auth_router
from analytics_api import router as analytics_router
from personal_mongo import router as profile_router
from pdf_api import router as pdf_router
from recommendation_api import router as recommendation_router

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
app.include_router(analytics_router)
app.include_router(profile_router)
app.include_router(pdf_router)
app.include_router(recommendation_router)

# Request Models
class StartSessionRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    user_id: str = "guest"

    @field_validator("query")
    @classmethod
    def validate_query_not_blank(cls, query: str) -> str:
        cleaned = query.strip()
        if not cleaned:
            raise ValueError("Enter a topic you want to learn.")
        return cleaned

class SubmitAnswersRequest(BaseModel):
    session_id: str
    answers: dict[str, int]

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
    res = orchestrator.start_session(req.query.strip(), user_id)
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
        status_code = 404 if "Session not found" in res["error"] else 400
        raise HTTPException(status_code=status_code, detail=res["error"])
    return res