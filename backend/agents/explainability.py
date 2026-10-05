import json
from services.llm_client import call_groq
from utils.json_utils import extract_and_parse_json

def generate_explanations(roadmap: list, difficulty_info: dict, style: str) -> list:
    """Generates step-by-step explanations for the entire roadmap in a single LLM call."""
    diff_level = difficulty_info.get("difficulty", "intermediate")
    
    # Create a lightweight version of the roadmap to send to the LLM to save tokens
    simplified_roadmap = [{"id": step.get("id"), "title": step.get("title")} for step in roadmap]
    
    system_instruction = (
        f"You are an AI tutor explaining a learning path to a student with a '{style}' learning style "
        f"at an '{diff_level}' level. "
        "For each step in the roadmap, write a 1-sentence explanation of why this specific topic fits their profile. "
        "Return ONLY a JSON array of objects, where each object has exactly two keys: 'step_id' and 'explanation'."
    )
    
    prompt = f"Roadmap steps: {json.dumps(simplified_roadmap)}"
    
    try:
        res = call_groq(prompt, system_instruction=system_instruction, max_tokens=1000)
        parsed = extract_and_parse_json(res)
        
        # Verify Gemini returned a valid list of explanations
        if isinstance(parsed, list) and len(parsed) > 0:
            return parsed
    except Exception as e:
        print(f"[Explainability Agent] Batch explanation error: {e}")
        
    # Fallback only triggers if the single bulk call fails
    explanations = []
    for step in roadmap:
        explanations.append({
            "step_id": step.get("id"),
            "explanation": f"This step builds foundational competency in {step.get('title')} aligned with your {diff_level} path."
        })
    return explanations