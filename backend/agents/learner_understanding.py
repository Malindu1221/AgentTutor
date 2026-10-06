import hashlib
from services.llm_client import call_groq
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
        response = call_groq(prompt, system_instruction=system_instruction, temperature=0.3)
        mcqs = extract_and_parse_json(response)
        
        if isinstance(mcqs, list) and len(mcqs) == n:
            normalized = []
            seen_ids = set()
            for idx, question in enumerate(mcqs):
                if not isinstance(question, dict):
                    break
                prompt_text = question.get("question")
                options = question.get("options")
                correct = question.get("correct")
                if (
                    not isinstance(prompt_text, str)
                    or not prompt_text.strip()
                    or not isinstance(options, list)
                    or len(options) != 4
                    or not all(isinstance(option, str) and option.strip() for option in options)
                    or isinstance(correct, bool)
                    or not isinstance(correct, int)
                    or not 0 <= correct < len(options)
                ):
                    break
                question_id = question.get("id")
                if not isinstance(question_id, str) or not question_id.strip():
                    question_id = (
                        f"q_{idx + 1}_"
                        f"{hashlib.md5(prompt_text.encode()).hexdigest()[:6]}"
                    )
                if question_id in seen_ids:
                    break
                seen_ids.add(question_id)
                normalized.append({
                    "id": question_id,
                    "question": prompt_text.strip(),
                    "options": options,
                    "correct": correct,
                })
            if len(normalized) == n:
                return normalized
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
        try:
            answer_index = int(user_ans)
        except (TypeError, ValueError, OverflowError):
            continue
        if (
            not isinstance(user_ans, bool)
            and str(answer_index) == str(user_ans).strip()
            and answer_index == q.get("correct")
        ):
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