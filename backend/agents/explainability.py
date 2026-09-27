from services.llm_client import call_gemini
from utils.json_utils import extract_and_parse_json

def generate_explanations(roadmap: list, difficulty_info: dict, style: str) -> list:
    """Generates step-by-step explanations for why each step fits the user."""
    explanations = []
    diff_level = difficulty_info.get("difficulty", "intermediate")

    for step in roadmap:
        step_id = step.get("id")
        title = step.get("title")

        system_instruction = (
            f"In 1-2 sentences, explain why learning step '{title}' is suitable for a user "
            f"assessed at '{diff_level}' level with a '{style}' learning style. "
            "Return ONLY a JSON object: {\"step_id\": \"...\", \"explanation\": \"...\", \"confidence\": 0.85}"
        )
        prompt = f"Step ID: {step_id}, Title: {title}"

        try:
            res = call_gemini(prompt, system_instruction=system_instruction, max_tokens=150)
            parsed = extract_and_parse_json(res)
            if isinstance(parsed, dict) and "explanation" in parsed:
                explanations.append(parsed)
                continue
        except Exception:
            pass

        explanations.append({
            "step_id": step_id,
            "explanation": f"This step builds foundational competency in {title} aligned with your {diff_level} path.",
            "confidence": 0.75
        })

    return explanations