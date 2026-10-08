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

    def short_text(value, byte_limit: int) -> str:
        text = str(value or "")
        return text.encode("utf-8")[:byte_limit].decode("utf-8", errors="ignore")

    # Only include information needed for the quality check. Keep the serialized
    # roadmap bounded so even unusually large generated roadmaps stay small.
    compact_roadmap = []
    for index, module in enumerate(roadmap or [], start=1):
        if not isinstance(module, dict):
            continue
        step = {
            "step": short_text(module.get("id") or index, 20),
            "title": short_text(module.get("title"), 120),
            "resources": [],
        }
        resources = module.get("resources") or []
        if isinstance(resources, list):
            for resource in resources:
                if not isinstance(resource, dict):
                    continue
                item = {
                    "title": short_text(resource.get("title"), 100),
                    "url": short_text(resource.get("url"), 180),
                }
                if item["title"] or item["url"]:
                    step["resources"].append(item)
                if len(step["resources"]) == 3:
                    break

        candidate = compact_roadmap + [step]
        # Bound UTF-8 input bytes, then reserve room for instructions and output.
        serialized_candidate = json.dumps(candidate, ensure_ascii=False, separators=(",", ":"))
        if len(serialized_candidate.encode("utf-8")) > 3600:
            break
        compact_roadmap.append(step)

    system_instruction = "Check roadmap safety and domain relevance. Return JSON only."
    prompt = (
        f"Domain: {short_text(domain, 120)}\n"
        f"Roadmap: {json.dumps(compact_roadmap, ensure_ascii=False, separators=(',', ':'))}\n"
        'Return JSON: {"is_safe":true,"feedback":"brief reason or Approved"}.'
    )
    
    try:
        response_text = call_groq(
            prompt=prompt, 
            system_instruction=system_instruction, 
            temperature=0.1,
            max_tokens=256,
        )
        
        # Clean the response to ensure valid JSON parsing
        text = response_text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"[Safety Agent] Error during verification: {e}")
        # Default to safe to prevent pipeline blockage on API timeout
        return {"is_safe": True, "feedback": "Bypassed due to API error."}
