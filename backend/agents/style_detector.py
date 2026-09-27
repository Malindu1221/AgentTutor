from services.llm_client import call_gemini

VALID_STYLES = ["visual", "auditory", "reading", "kinesthetic", "mixed"]

def detect_style(query: str, user_profile: dict = None) -> str:
    """Detects primary learning style preference from the user input."""
    system_instruction = (
        "Analyze the user query and state their implied learning style preference. "
        f"Output ONLY one single word from this list: {', '.join(VALID_STYLES)}."
    )
    prompt = f"Query: '{query}'"
    
    try:
        response = call_gemini(prompt, system_instruction=system_instruction, max_tokens=10)
        cleaned = response.strip().lower()
        if cleaned in VALID_STYLES:
            return cleaned
    except Exception:
        pass
        
    return "mixed"