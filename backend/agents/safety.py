import re

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