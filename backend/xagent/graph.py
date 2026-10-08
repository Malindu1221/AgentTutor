from langgraph.graph import StateGraph, START, END
from xagent.state import AgentTutorState

from xagent.nodes import (
    adapt_roadmap_node,
    finalize_node,
    generate_assessment_node,
    generate_roadmap_node,
    rank_content_node,
    retrieve_content_node,
    validate_topic_node,
    verify_content_node,
    web_search_node,
)

MAX_VERIFICATION_RETRIES = 2


def route_after_validation(state: AgentTutorState) -> str:
    """Routes valid topics into assessment or roadmap generation."""
    if state.get("topic_validation_status") != "valid_topic":
        return "stop"
    if state.get("workflow_mode") == "assessment":
        return "assessment"
    return "roadmap"

def should_review(state: AgentTutorState) -> str:
    """Retry roadmap refinement for quality failures, up to the configured limit."""
    if (
        state.get("review_required")
        and state.get("verification_retries", 0) < MAX_VERIFICATION_RETRIES
    ):
        return "review"
    return "finalize"


def increment_verification_retries(state: AgentTutorState) -> dict[str, int]:
    """Count a scheduled rework pass before the graph returns to adaptation."""
    return {"verification_retries": state.get("verification_retries", 0) + 1}


def build_graph():
    """Builds and compiles the AgentTutor LangGraph DAG."""
    builder = StateGraph(AgentTutorState)

    # 1. Add Nodes
    builder.add_node("validate_topic", validate_topic_node)
    builder.add_node("assessment", generate_assessment_node)
    builder.add_node("roadmap_generation", generate_roadmap_node)
    builder.add_node("adapt", adapt_roadmap_node)
    builder.add_node("retrieve", retrieve_content_node)
    
    
    builder.add_node("web_search", web_search_node)
    builder.add_node("rank_content", rank_content_node)
    
    builder.add_node("verify", verify_content_node)
    builder.add_node("increment_verification_retries", increment_verification_retries)
    # Updated to call your actual explainability function instead of the lambda
    builder.add_node("finalize", finalize_node)

    # 2. Add Edges
    builder.add_edge(START, "validate_topic")
    builder.add_conditional_edges(
        "validate_topic",
        route_after_validation,
        {
            "stop": END,
            "assessment": "assessment",
            "roadmap": "roadmap_generation",
        },
    )
    builder.add_edge("assessment", END)
    builder.add_edge("roadmap_generation", "adapt")
    builder.add_edge("adapt", "retrieve")
    
    # Retrieval and ranking run before roadmap verification.
    builder.add_edge("retrieve", "web_search")
    builder.add_edge("web_search", "rank_content")
    builder.add_edge("rank_content", "verify")
    
    # 3. Add Conditional Routing
    builder.add_conditional_edges(
        "verify",
        should_review,
        {
            "review": "increment_verification_retries",
            "finalize": "finalize",
        }
    )
    builder.add_edge("increment_verification_retries", "adapt")
    
    builder.add_edge("finalize", END)

    # 4. Compile Graph
    return builder.compile()

tutor_graph = build_graph()