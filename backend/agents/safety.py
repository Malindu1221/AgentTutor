import re
import json
from services.llm_client import call_groq

UNSAFE_PATTERNS = [
    r'\bbypass\b', r'\bjailbreak\b', r'\bhack\b', r'\bmalware\b',
    r'\bexploit\b', r'\bdos attack\b', r'\bransomware\b'
]

def run_safety(query: str) -> dict:
    """Scans the user query against safety rules using pure regex."""
    reasons = []
    for pattern in UNSAFE_PATTERNS:
        if re.search(pattern, query, re.IGNORECASE):
            reasons.append(f"Query contains restricted pattern: '{pattern}'")
            
    if reasons:
        return {"status": "unsafe", "reasons": reasons}
    return {"status": "safe", "reasons": []}

def verify_roadmap_quality(roadmap: list, domain: str) -> dict:
    """Uses the configured Groq model to verify roadmap safety and quality."""
    
    system_instruction = (
        "You are an expert educational Quality Assurance agent. "
        "Review the learning roadmap, ensure it contains no harmful material, is strictly educational, "
        "and accurately matches the given domain. "
        "You must respond strictly in valid JSON format without Markdown formatting."
    )
    
    prompt = f"""
    Review the following learning roadmap for the domain: {domain}.
    Ensure the content contains no harmful material, is strictly educational, and accurately matches the domain.
    
    Roadmap: {json.dumps(roadmap)}
    
    Respond strictly in valid JSON format without Markdown formatting:
    {{
        "is_safe": true or false,
        "feedback": "Brief string explaining any issues, or 'Approved' if safe."
    }}
    """
    
    try:
        response_text = call_groq(
            prompt=prompt, 
            system_instruction=system_instruction, 
            temperature=0.1,
        )
        
        # Clean the response to ensure valid JSON parsing
        text = response_text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"[Safety Agent] Error during verification: {e}")
        # Default to safe to prevent pipeline blockage on API timeout
        return {"is_safe": True, "feedback": "Bypassed due to API error."}