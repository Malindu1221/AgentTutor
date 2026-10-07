from typing import TypedDict, List, Dict, Any, Literal, NotRequired

class AgentTutorState(TypedDict):
    """The shared state that flows through the LangGraph recommendation pipeline."""
    session_id: str
    query: str
    domain: NotRequired[str]
    difficulty_level: NotRequired[str]
    learning_style: NotRequired[str]
    workflow_mode: NotRequired[Literal["assessment", "roadmap"]]
    topic_validated: NotRequired[bool]
    topic_validation_status: NotRequired[Literal["valid_topic", "gibberish", "failed"]]
    workflow_error: NotRequired[str]
    mcqs: NotRequired[List[Dict[str, Any]]]
    
    # Data from Orchestrator (Phase 2)
    base_roadmap: NotRequired[List[Dict[str, Any]]]
    user_profile: NotRequired[Dict[str, Any]]
    evaluation: NotRequired[Dict[str, Any]]
    
    # LangGraph Output
    refined_roadmap: NotRequired[List[Dict[str, Any]]]
    final_recommendations: NotRequired[Dict[str, Any]]
    review_required: NotRequired[bool]
    verification_retries: NotRequired[int]
    status_message: NotRequired[str]