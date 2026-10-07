from langgraph.graph import StateGraph, START, END
from xagent.state import AgentTutorState

from xagent.nodes import (
    adapt_roadmap_node,
    finalize_node,
    generate_assessment_node,
    generate_roadmap_node,
    retrieve_content_node,
    validate_topic_node,
    verify_content_node,
    web_search_node,
)

def route_after_validation(state: AgentTutorState) -> str:
    """Routes valid topics into assessment or roadmap generation."""
    if state.get("topic_validation_status") != "valid_topic":
        return "stop"
    if state.get("workflow_mode") == "assessment":
        return "assessment"
    return "roadmap"

def should_review(state: AgentTutorState) -> str:
    """Conditional edge router based on verification results."""
    if state.get("review_required"):
        return "review"
    return "finalize"

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
    
    builder.add_node("verify", verify_content_node)
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
    
    # New Edges: retrieve (YouTube) -> web_search (Tavily) -> verify
    builder.add_edge("retrieve", "web_search")
    builder.add_edge("web_search", "verify")
    
    # 3. Add Conditional Routing
    builder.add_conditional_edges(
        "verify",
        should_review,
        {
            "review": END, 
            "finalize": "finalize"
        }
    )
    
    builder.add_edge("finalize", END)

    # 4. Compile Graph
    return builder.compile()

tutor_graph = build_graph()