import uuid
from concurrent.futures import ThreadPoolExecutor
from agents.safety import run_safety
from agents.classifier import run_classifier
from agents.style_detector import detect_style
from agents.learner_understanding import generate_mcqs, evaluate_answers
from agents.roadmap import generate_roadmap
from agents.content import recommend_content
from agents.explainability import generate_explanations
from services.sqlite_store import save_context, load_context
from xagent.graph import tutor_graph
from personal_mongo import get_profile_for_user

def start_session(query: str, user_id: str = "guest") -> dict:
    """Phase 1 Pipeline: Runs Safety -> Classifier -> Style Detector -> MCQ Generator."""
    # 1. Safety Check
    safety = run_safety(query)
    if safety.get("status") != "safe":
        return {"error": "Query blocked by safety filter", "reasons": safety.get("reasons")}

    # 2. Classifier
    classification = run_classifier(query)
    domain = classification.get("domain", "general")
    intent = classification.get("intent", "learn")

    # 3. Style Detector
    style = detect_style(query)

    # 4. MCQ Generator
    mcqs = generate_mcqs(query, domain, n=5)

    session_id = str(uuid.uuid4())
    context = {
        "session_id": session_id,
        "user_id": user_id,
        "query": query,
        "domain": domain,
        "intent": intent,
        "style": style,
        "mcqs": mcqs,
        "stage": "awaiting_answers"
    }

    save_context(session_id, user_id, context)

    # Hide correct answers from public response
    public_mcqs = [{k: v for k, v in q.items() if k != "correct"} for q in mcqs]

    return {
        "session_id": session_id,
        "domain": domain,
        "intent": intent,
        "style": style,
        "mcqs": public_mcqs
    }

def submit_answers(
    session_id: str,
    user_answers: dict,
    user_id: str = "guest",
) -> dict:
    """Phase 2 Pipeline: Evaluates answers -> Roadmap -> Parallel Content & Explanations."""
    context = load_context(session_id)
    if not context:
        return {"error": "Session not found"}
    if context.get("user_id", "guest") != user_id:
        return {"error": "Session not found or access denied"}
    if context.get("stage") == "completed":
        return {
            "session_id": session_id,
            "evaluation": context.get("difficulty", {}),
            "roadmap": context.get("roadmap", []),
            "recommendations": context.get("recommendations", {}),
            "explanations": context.get("explanations", []),
        }
    if context.get("stage") != "awaiting_answers":
        return {"error": "Session is not awaiting answers"}

    mcqs = context.get("mcqs", [])
    expected_answer_ids = {question.get("id") for question in mcqs}
    if set(user_answers) != expected_answer_ids:
        return {"error": "Please submit one answer for every assessment question"}
    for question in mcqs:
        answer = user_answers.get(question.get("id"))
        options = question.get("options", [])
        if isinstance(answer, bool) or not isinstance(answer, int) or not 0 <= answer < len(options):
            return {"error": "One or more assessment answers are invalid"}

    query = context.get("query", "")
    domain = context.get("domain", "general")
    style = context.get("style", "mixed")
    user_profile = get_profile_for_user(user_id) if user_id != "guest" else {}
    user_profile = user_profile or {}

    # 1. Evaluate answers
    eval_result = evaluate_answers(mcqs, user_answers)
    difficulty = eval_result.get("difficulty", "intermediate")

    # 2. Generate Roadmap
    roadmap = generate_roadmap(query, difficulty, style, domain)
    # 2.5 Refine Roadmap via LangGraph
    initial_state = {
        "session_id": session_id,
        "query": query,
        "domain": domain,
        "difficulty_level": difficulty,
        "learning_style": style,
        "base_roadmap": roadmap,
        "user_profile": user_profile,
        "evaluation": eval_result,
    }
    
    final_state = tutor_graph.invoke(initial_state)
    roadmap = final_state.get("refined_roadmap", roadmap)

    # 3. Parallel Content and Explanation Generation via ThreadPoolExecutor
    recommendations = {}
    explanations = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        content_future = executor.submit(
            recommend_content,
            roadmap,
            domain,
            difficulty,
            3,
            user_profile,
        )
        explain_future = executor.submit(
            generate_explanations,
            roadmap,
            eval_result,
            style,
            user_profile,
        )

        recommendations = content_future.result()
        explanations = explain_future.result()

    if not isinstance(recommendations, dict):
        recommendations = {}
    if not isinstance(explanations, list):
        explanations = []

    explanations_by_id = {
        str(item.get("step_id")): item.get("explanation")
        for item in explanations
        if isinstance(item, dict)
        and item.get("step_id") is not None
        and isinstance(item.get("explanation"), str)
    }
    for step in roadmap:
        step_id = str(step.get("id", ""))
        if not step.get("step_explanation") and step_id in explanations_by_id:
            step["step_explanation"] = explanations_by_id[step_id]

        step_recommendations = recommendations.get(step.get("title"), [])
        if not isinstance(step_recommendations, list):
            step_recommendations = []
        if not step.get("resources") and step_recommendations:
            step["resources"] = [
                {
                    "title": item.get("title", "Recommended learning resource"),
                    "url": item["url"],
                    "description": item.get("description", ""),
                    "type": "recommended_resource",
                }
                for item in step_recommendations
                if isinstance(item, dict)
                and isinstance(item.get("url"), str)
                and item["url"].startswith(("https://", "http://"))
            ]

    context["difficulty"] = eval_result
    context["roadmap"] = roadmap
    context["recommendations"] = recommendations
    context["explanations"] = explanations
    context["stage"] = "completed"

    save_context(session_id, context.get("user_id", "guest"), context)

    return {
        "session_id": session_id,
        "evaluation": eval_result,
        "roadmap": roadmap,
        "recommendations": recommendations,
        "explanations": explanations
    }