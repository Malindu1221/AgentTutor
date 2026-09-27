import hashlib
from services.llm_client import call_gemini
from utils.json_utils import extract_and_parse_json

def generate_mcqs(topic: str, domain: str, n: int = 5) -> list:
    """Generates MCQs to assess baseline user knowledge."""
    system_instruction = (
        f"Generate exactly {n} multiple choice questions to assess knowledge level on '{topic}' "
        f"within the domain of '{domain}'. Return ONLY a JSON array of objects with fields: "
        "\"id\", \"question\", \"options\" (array of 4 strings), and \"correct\" (0-based integer index of correct answer)."
    )
    prompt = f"Topic: {topic}"
    
    try:
        response = call_gemini(prompt, system_instruction=system_instruction, temperature=0.3)
        mcqs = extract_and_parse_json(response)
        
        if isinstance(mcqs, list) and len(mcqs) == n:
            for idx, q in enumerate(mcqs):
                if "id" not in q:
                    q["id"] = f"q_{idx+1}_{hashlib.md5(q.get('question', '').encode()).hexdigest()[:6]}"
            return mcqs
    except Exception:
        pass

    # Dummy Fallback MCQs
    return [
        {
            "id": f"q_{i+1}",
            "question": f"Sample Diagnostic Question {i+1} on {topic}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct": 0
        } for i in range(n)
    ]

def evaluate_answers(mcqs: list, user_answers: dict) -> dict:
    """Evaluates user quiz responses and assigns difficulty grade level."""
    if not mcqs:
        return {"score": 0, "total": 0, "difficulty": "intermediate"}
        
    correct_count = 0
    total = len(mcqs)
    
    for q in mcqs:
        q_id = q.get("id")
        user_ans = user_answers.get(q_id)
        if user_ans is not None and int(user_ans) == q.get("correct"):
            correct_count += 1
            
    percentage = (correct_count / total) * 100 if total > 0 else 0
    
    if percentage < 30:
        difficulty = "beginner"
    elif percentage >= 80:
        difficulty = "advanced"
    else:
        difficulty = "intermediate"
        
    return {
        "score": correct_count,
        "total": total,
        "percentage": percentage,
        "difficulty": difficulty
    }