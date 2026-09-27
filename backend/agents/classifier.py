from services.llm_client import call_gemini
from utils.json_utils import extract_and_parse_json

VALID_DOMAINS = [
    "programming", "data-science", "math", "physics", "chemistry",
    "biology", "history", "languages", "art", "music", "business",
    "finance", "general"
]

def run_classifier(query: str) -> dict:
    """Classifies user query into domain and intent."""
    system_instruction = (
        "You are an educational query classifier. Classify the user query into "
        f"one of these domains: {', '.join(VALID_DOMAINS)}. "
        "Also determine intent (e.g., learn, review, practice, explore). "
        "Return ONLY a valid JSON object: {\"domain\": \"...\", \"intent\": \"...\"}"
    )
    
    prompt = f"Query: '{query}'"
    
    try:
        response = call_gemini(prompt, system_instruction=system_instruction, temperature=0.1)
        parsed = extract_and_parse_json(response)
        
        if parsed and "domain" in parsed:
            domain = parsed.get("domain", "").lower()
            if domain not in VALID_DOMAINS:
                domain = "general"
            return {"domain": domain, "intent": parsed.get("intent", "learn")}
    except Exception:
        pass

    # Keyword Fallback Heuristic
    query_lower = query.lower()
    if "python" in query_lower or "code" in query_lower or "java" in query_lower:
        return {"domain": "programming", "intent": "learn"}
    elif "math" in query_lower or "calculus" in query_lower:
        return {"domain": "math", "intent": "learn"}
    
    return {"domain": "general", "intent": "learn"}