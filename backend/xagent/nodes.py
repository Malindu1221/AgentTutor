import json
from xagent.state import AgentTutorState
from services.llm_client import call_gemini
from utils.json_utils import extract_and_parse_json
from agents.content import fetch_youtube_resources

def adapt_roadmap_node(state: AgentTutorState) -> AgentTutorState:
    """Modifies the base roadmap to deeply align with the user's specific learning style."""
    print(f"[LangGraph] Adapting roadmap for {state.get('learning_style')} learning style...")
    
    base_roadmap = state.get("base_roadmap", [])
    style = state.get("learning_style", "mixed")
    
    system_instruction = (
        f"You are a learning path optimizer. Rewrite the provided roadmap to specifically target a '{style}' learning style. "
        "Keep the same 'id' and 'estimated_time_hours' for each step, but heavily update 'title' and 'description' to reflect visual, auditory, reading, or kinesthetic methodologies as appropriate. "
        "Return ONLY a JSON array of the modified steps."
    )
    
    prompt = f"Base Roadmap: {json.dumps(base_roadmap)}"
    
    try:
        response = call_gemini(prompt, system_instruction=system_instruction, max_tokens=1500)
        refined = extract_and_parse_json(response)
        
        # Verify output matches expected structure
        if isinstance(refined, list) and len(refined) == len(base_roadmap):
            state["refined_roadmap"] = refined
            state["status_message"] = "Roadmap adapted successfully."
            return state
    except Exception as e:
        print(f"[LangGraph] LLM Adaptation failed: {e}")
        
    state["refined_roadmap"] = base_roadmap
    state["status_message"] = "Fallback: Base roadmap retained."
    return state

def verify_content_node(state: AgentTutorState) -> AgentTutorState:
    """Verifies that the generated roadmap meets quality thresholds."""
    print("[LangGraph] Verifying roadmap content quality...")
    
    refined = state.get("refined_roadmap", [])
    
    # Simple heuristic verification
    if not refined or not isinstance(refined, list):
        state["review_required"] = True
        state["status_message"] = "Refined roadmap invalid or empty."
    else:
        state["review_required"] = False
        state["status_message"] = "Roadmap verified and finalized."
        
        return state

def retrieve_content_node(state: AgentTutorState) -> AgentTutorState:
    """Enhances the refined roadmap by appending specific YouTube resources to each module."""
    print("[LangGraph] Fetching YouTube learning resources for roadmap modules...")
    
    roadmap = state.get("refined_roadmap", [])
    domain = state.get("domain", "")
    
    for module in roadmap:
        search_query = f"{domain} {module.get('title')}"
        # Fetch 2 video links per module
        resources = fetch_youtube_resources(search_query, max_results=2)
        module["resources"] = resources
        
    state["refined_roadmap"] = roadmap
    state["status_message"] = "YouTube content resources appended."
    
    return state   
    