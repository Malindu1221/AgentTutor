from services.llm_client import call_groq
from utils.json_utils import extract_and_parse_json

def generate_roadmap(topic: str, difficulty: str, style: str, domain: str) -> list:
    """Generates a structured 6-step personalized learning roadmap."""
    system_instruction = (
        f"You are an expert curriculum designer for the domain '{domain}'. "
        f"Create a custom 6-step roadmap for learning '{topic}'. "
        f"Target learner difficulty level: '{difficulty}'. Preferred learning style: '{style}'. "
        "Return ONLY a JSON array of 6 step objects with these keys: "
        "\"id\" (e.g. 's1', 's2'...), \"title\", \"description\", \"estimated_time_hours\" (int), \"prereq\" (array of strings)."
    )
    prompt = f"Topic: {topic}"

    try:
        response = call_groq(prompt, system_instruction=system_instruction, max_tokens=900)
        roadmap = extract_and_parse_json(response)
        if isinstance(roadmap, list) and len(roadmap) > 0:
            return roadmap
    except Exception:
        pass

    # Generic Fallback Roadmap
    return [
        {"id": "s1", "title": f"Foundations of {topic}", "description": f"Introduction to baseline concepts in {topic}.", "estimated_time_hours": 3, "prereq": []},
        {"id": "s2", "title": "Core Principles", "description": "Key mechanisms, terminology, and foundational structures.", "estimated_time_hours": 5, "prereq": ["s1"]},
        {"id": "s3", "title": "Practical Application", "description": "Hands-on implementation and basic workflow construction.", "estimated_time_hours": 6, "prereq": ["s2"]},
        {"id": "s4", "title": "Intermediate Techniques", "description": "Expanding knowledge with domain-specific patterns.", "estimated_time_hours": 8, "prereq": ["s3"]},
        {"id": "s5", "title": "Advanced Topics", "description": "Optimization, best practices, and edge-case handling.", "estimated_time_hours": 10, "prereq": ["s4"]},
        {"id": "s6", "title": "Capstone Project", "description": "Building an end-to-end practical deliverable.", "estimated_time_hours": 12, "prereq": ["s5"]}
    ]