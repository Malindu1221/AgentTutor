from langgraph.graph import StateGraph, START, END
from xagent.state import AgentTutorState
from xagent.nodes import adapt_roadmap_node, verify_content_node, retrieve_content_node

def should_review(state: AgentTutorState) -> str:
    """Conditional edge router based on verification results."""
    if state.get("review_required"):
        return "review"
    return "finalize"

def build_graph():
    """Builds and compiles the AgentTutor LangGraph DAG."""
    builder = StateGraph(AgentTutorState)

    # 1. Add Nodes
    builder.add_node("adapt", adapt_roadmap_node)
    builder.add_node("retrieve", retrieve_content_node)
    builder.add_node("verify", verify_content_node)
    builder.add_node("finalize", lambda state: state)

    # 2. Add Edges
    builder.add_edge(START, "adapt")
    builder.add_edge("adapt", "retrieve")
    builder.add_edge("retrieve", "verify")
    
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