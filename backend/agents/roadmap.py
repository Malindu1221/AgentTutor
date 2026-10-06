from services.llm_client import call_groq
from utils.json_utils import extract_and_parse_json

FALLBACK_HOURS = [3, 5, 6, 8, 10, 12]


def _fallback_step(topic: str, index: int) -> dict:
    steps = [
        (f"Foundations of {topic}", f"Introduction to baseline concepts in {topic}.", []),
        ("Core Principles", "Key mechanisms, terminology, and foundational structures.", ["s1"]),
        ("Practical Application", "Hands-on implementation and basic workflow construction.", ["s2"]),
        ("Intermediate Techniques", "Expanding knowledge with domain-specific patterns.", ["s3"]),
        ("Advanced Topics", "Optimization, best practices, and edge-case handling.", ["s4"]),
        ("Capstone Project", "Build an end-to-end practical deliverable.", ["s5"]),
    ]
    title, description, prereq = steps[index]
    return {
        "id": f"s{index + 1}",
        "title": title,
        "description": description,
        "estimated_time_hours": FALLBACK_HOURS[index],
        "prereq": prereq,
    }


def _normalize_roadmap(candidate: object, topic: str) -> list[dict]:
    generated = candidate if isinstance(candidate, list) else []
    normalized = []
    used_ids = set()

    for index in range(6):
        fallback = _fallback_step(topic, index)
        step = generated[index] if index < len(generated) else None
        if not isinstance(step, dict):
            normalized.append(fallback)
            continue

        step_id = step.get("id")
        if not isinstance(step_id, str) or not step_id.strip() or step_id in used_ids:
            step_id = fallback["id"]
        used_ids.add(step_id)
        title = step.get("title")
        description = step.get("description")
        hours = step.get("estimated_time_hours")
        prereq = step.get("prereq")
        normalized.append({
            **step,
            "id": step_id,
            "title": title.strip() if isinstance(title, str) and title.strip() else fallback["title"],
            "description": (
                description.strip()
                if isinstance(description, str) and description.strip()
                else fallback["description"]
            ),
            "estimated_time_hours": (
                hours if isinstance(hours, int) and not isinstance(hours, bool) and hours > 0
                else fallback["estimated_time_hours"]
            ),
            "prereq": (
                [value for value in prereq if isinstance(value, str)]
                if isinstance(prereq, list)
                else fallback["prereq"]
            ),
        })
    return normalized


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
        if isinstance(roadmap, list) and roadmap:
            return _normalize_roadmap(roadmap, topic)
    except Exception:
        pass

    return [_fallback_step(topic, index) for index in range(6)]