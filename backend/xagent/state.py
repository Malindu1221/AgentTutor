from typing import TypedDict, List, Dict, Any

class AgentTutorState(TypedDict):
    """The shared state that flows through the LangGraph recommendation pipeline."""
    session_id: str
    query: str
    domain: str
    difficulty_level: str
    learning_style: str
    
    # Data from Orchestrator (Phase 2)
    base_roadmap: List[Dict[str, Any]]
    
    # LangGraph Output
    refined_roadmap: List[Dict[str, Any]]
    final_recommendations: Dict[str, Any]
    review_required: bool
    status_message: str