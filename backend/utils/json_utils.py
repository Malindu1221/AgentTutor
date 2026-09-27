import json
import re

def extract_and_parse_json(text: str):
    """Extracts JSON from text (stripping Markdown formatting) and parses it."""
    if not text:
        return None

    # Strip markdown block wrappers if present
    cleaned_text = re.sub(r'```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    cleaned_text = cleaned_text.replace('```', '').strip()

    # Attempt standard JSON loading
    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        pass

    # Fallback pattern match for standard JSON object or array
    match = re.search(r'(\{.*\}|\[.*\])', cleaned_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    return None