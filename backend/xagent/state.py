from typing import TypedDict, List, Dict, Any, Literal, NotRequired

class LearningResource(TypedDict, total=False):
    """A YouTube or web resource attached to a roadmap step."""

    title: str
    description: str
    url: str
    thumbnail: str
    type: str
    relevance_score: float


class RoadmapStep(TypedDict, total=False):
    """A roadmap step and its source-specific and ranked resources."""

    id: str
    title: str
    description: str
    estimated_time_hours: int
    youtube_resources: List[LearningResource]
    resources: List[LearningResource]
    web_resources: List[LearningResource]
    ranked_resources: List[LearningResource]


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
    base_roadmap: NotRequired[List[RoadmapStep]]
    user_profile: NotRequired[Dict[str, Any]]
    evaluation: NotRequired[Dict[str, Any]]
    
    # LangGraph Output
    refined_roadmap: NotRequired[List[RoadmapStep]]
    youtube_resources: NotRequired[List[LearningResource]]
    ranked_resources: NotRequired[List[LearningResource]]
    seen_youtube_urls: NotRequired[List[str]]
    final_recommendations: NotRequired[Dict[str, Any]]
    review_required: NotRequired[bool]
    verification_retries: NotRequired[int]
    status_message: NotRequired[str]
