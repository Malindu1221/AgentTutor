# AgentTutor: How the System Works

This document describes the project's **current implementation**. The agents are Python functions coordinated by the backend—not separate services that communicate with each other directly. The coordinator passes their outputs along, and the LangGraph workflow shares a state object between its steps.

## Main components

- **Frontend:** A Next.js web app where a learner enters a topic, answers a diagnostic quiz, and views the resulting learning path. See the [home page](./frontend/app/page.tsx), [assessment page](./frontend/app/assessment/page.tsx), and [roadmap page](./frontend/app/roadmap/page.tsx).
- **API:** A FastAPI backend with `/start_session` and `/submit_answers` endpoints, plus a basic health endpoint. See [main.py](./backend/main.py).
- **Authentication and profiles:** `/api/auth/register` and `/api/auth/login` issue bearer JWTs; `/api/profile/me` provides authenticated profile CRUD backed by MongoDB. See [auth.py](./backend/auth.py) and [personal_mongo.py](./backend/personal_mongo.py).
- **Personalized recommendations:** Authenticated `GET /recommendations` returns the latest saved user results; `POST /recommendations/generate` runs the recommendation LangGraph to collect YouTube and web resources, rank with local hashing-vector embeddings, and save them to MongoDB. See [recommendation_api.py](./backend/recommendation_api.py) and [recommendations.py](./backend/xagent/recommendations.py).
- **Orchestrator:** Coordinates the agents and stores session data between the two API phases. See [orchestrator.py](./backend/orchestrator.py).
- **Agents and workflow nodes:** Handle safety checks, classification, assessment, roadmap creation, resource retrieval, roadmap verification, and explanations. See the [agents directory](./backend/agents) and [LangGraph nodes](./backend/xagent/nodes.py).
- **Shared services:** Groq API calls go through [llm_client.py](./backend/services/llm_client.py); session context is stored in SQLite by [sqlite_store.py](./backend/services/sqlite_store.py).

## Agent roles and connections

| Agent or workflow step | Responsibility and output | How it connects |
|---|---|---|
| **Safety filter** — `run_safety` | Checks the learner's original query against a list of restricted terms and returns `safe` or `unsafe`, with matched-pattern reasons. | Runs first in `start_session`. An unsafe result stops session creation. Defined in [safety.py](./backend/agents/safety.py). |
| **Query classifier** — `run_classifier` | Uses the configured Groq model to assign a domain and intent. The domain is selected from a fixed list, including programming, math, science subjects, and general. | Runs after the input safety check. Its domain and intent are saved in the session and used by later steps. Defined in [classifier.py](./backend/agents/classifier.py). |
| **Learning-style detector** — `detect_style` | Estimates one of visual, auditory, reading, kinesthetic, or mixed from the query. | Runs after classification. Its result is used for roadmap creation, roadmap adaptation, and explanations. Defined in [style_detector.py](./backend/agents/style_detector.py). |
| **Learner assessment** — `generate_mcqs` and `evaluate_answers` | Creates five diagnostic questions, then scores the submitted answers and labels the learner beginner, intermediate, or advanced. | Question generation runs in phase one; answer evaluation runs in phase two. Defined in [learner_understanding.py](./backend/agents/learner_understanding.py). |
| **Roadmap generator** — `generate_roadmap` | Creates a six-step learning roadmap using the topic, domain, difficulty, and learning style. | Runs after answer evaluation. Its roadmap is passed as the starting roadmap to the LangGraph workflow. Defined in [roadmap.py](./backend/agents/roadmap.py). |
| **Roadmap adapter** — `adapt_roadmap_node` | Asks the configured Groq model to rewrite roadmap titles and descriptions to suit the learner's style while preserving each step's ID and estimated hours. | First step in the LangGraph workflow. It receives the base roadmap through shared state. Defined in [nodes.py](./backend/xagent/nodes.py). |
| **YouTube retriever** — `retrieve_content_node` / `fetch_youtube_resources` | Searches the YouTube Data API for up to two tutorial videos per roadmap module and attaches them as `resources`. | Runs after adaptation. It uses the user's query and each module title to form a search query. Requires `YOUTUBE_API_KEY`. Implemented in [nodes.py](./backend/xagent/nodes.py) and [content.py](./backend/agents/content.py). |
| **Web retriever** — `web_search_node` | Searches Tavily for up to two relevant web results per module and attaches them as `web_resources`. | Runs after YouTube retrieval and before roadmap verification. Requires `TAVILY_API_KEY`. Defined in [nodes.py](./backend/xagent/nodes.py). |
| **Roadmap quality verifier** — `verify_roadmap_quality` / `verify_content_node` | Asks the configured Groq model whether the roadmap is safe, educational, and appropriate for the domain. | Runs after resource retrieval. Its result determines whether the graph proceeds to finalization or ends. Defined in [safety.py](./backend/agents/safety.py) and [nodes.py](./backend/xagent/nodes.py). |
| **Explanation generator** — `generate_explanations` / `finalize_node` | Produces a short explanation for why each roadmap step fits the learner. The graph's finalizer attaches these to steps as `step_explanation`. | Runs at the end of the successful LangGraph path. The orchestrator also calls the explanation function separately after the graph. Defined in [explainability.py](./backend/agents/explainability.py) and [nodes.py](./backend/xagent/nodes.py). |
| **Content recommender** — `recommend_content` | Intended to recommend learning resources for each step, using SQLite cache or the configured Groq model and then search-link fallbacks. | The orchestrator calls it alongside its separate explanation call after the graph. Defined in [content.py](./backend/agents/content.py). Its current behavior has an important issue described below. |

## End-to-end workflow

### Phase 1: Start a learning session

1. The browser sends the learner's query to `POST /start_session`.
2. The API identifies the bearer-token user when one is present; without a token, it retains the guest flow. It passes the user ID and query to `orchestrator.start_session`.
3. The safety filter checks the query. If it finds a restricted pattern, the request returns an error and the later agents do not run.
4. The classifier determines the domain and intent.
5. The style detector estimates the learner's preferred style.
6. The assessment agent generates five MCQs.
7. The backend creates a session ID and saves the query, user ID, domain, intent, style, questions, and session stage to SQLite.
8. The API response omits the correct-answer field, so the browser receives questions and choices, but not the answer key.
9. The frontend displays the quiz.

The session is persisted by the SQLite service in [sqlite_store.py](./backend/services/sqlite_store.py).

### Phase 2: Evaluate answers and build the roadmap

1. The browser submits the session ID and answers to `POST /submit_answers`.
2. The orchestrator loads the saved session context. If no matching session exists, it returns a "Session not found" error.
3. The assessment agent scores the answers:
   - Below 30%: **beginner**
   - 30% through below 80%: **intermediate**
   - 80% or above: **advanced**
4. The roadmap agent creates a six-step base roadmap.
5. For an authenticated learner, the orchestrator loads that user's MongoDB profile by user ID and passes its education, work history, projects, and skills as context to the LangGraph workflow and recommendation/explanation generators.
6. LangGraph adapts the roadmap, adds YouTube resources, attempts web search, and verifies roadmap quality.
7. After the graph returns, the orchestrator runs the separate content recommender and explanation generator concurrently.
8. The orchestrator saves the completed context and returns the evaluation, roadmap, recommendations, and explanations.
9. The frontend displays the evaluation and roadmap, including any step explanations and resource links present on individual steps.

The frontend's two API calls are in the [home page](./frontend/app/page.tsx) and [assessment page](./frontend/app/assessment/page.tsx). The graph's node order and conditional routes are defined in [graph.py](./backend/xagent/graph.py).

## Connection map

```text
Browser
  ├─ POST /start_session
  │    └─ Orchestrator
  │         ├─ Safety filter
  │         ├─ Query classifier
  │         ├─ Learning-style detector
  │         ├─ MCQ generator
  │         └─ SQLite: save session
  │
  └─ POST /submit_answers
       └─ Orchestrator
            ├─ SQLite: load session
            ├─ Answer evaluator
            ├─ MongoDB: load authenticated learner profile (if present)
            ├─ Roadmap generator
            ├─ LangGraph
            │    ├─ Adapt roadmap
            │    ├─ Retrieve YouTube resources
            │    ├─ Search Tavily for web resources
            │    ├─ Verify roadmap
            │    └─ Finalize with step explanations, if approved
            ├─ In parallel:
            │    ├─ Separate content recommendation call
            │    └─ Separate explanation call
            └─ SQLite: save completed session
```

These are **function-call and shared-state connections**, not direct agent-to-agent messaging. The orchestrator determines which Python functions run, and LangGraph carries workflow data in the typed state defined in [state.py](./backend/xagent/state.py). Groq API requests are centralized through [llm_client.py](./backend/services/llm_client.py).

Authentication uses bearer tokens in the `Authorization` header. Authenticated sessions are tied to the MongoDB user ID and cannot be submitted by another account; requests without a token continue to use the guest session path. The profile's learning-related fields are used only when present, and are sent as contextual input to Groq for personalization.

The dedicated recommendation flow uses the JWT subject and email, loads the caller's MongoDB profile, queries YouTube and Tavily using up to five profile-derived topics, computes vector similarity between the profile and each result, and persists the top fifteen results in the MongoDB `recommendations` collection. Both provider keys must be configured for this combined search flow.

## Important current behavior and limitations

- **Roadmap verification does not trigger a rework loop.** If verification marks the roadmap for review, the graph routes to `END`; there is no review or retry node. The orchestrator still continues with the roadmap returned by the graph. See [graph.py](./backend/xagent/graph.py).
- **Verification errors default to approved.** If the Groq quality-verification call fails, the safety helper returns `is_safe: True`, so the graph can continue rather than stopping on that error. See [safety.py](./backend/agents/safety.py).
- **The separate content recommender currently does not return its recommendations.** `recommend_content` builds a dictionary, but its function has no return statement. As a result, the orchestrator receives `None` for `recommendations`, despite the function's intended Groq/cache/fallback behavior. See [content.py](./backend/agents/content.py) and [orchestrator.py](./backend/orchestrator.py).
- **The frontend renders resources attached to roadmap steps.** It reads each step's `resources` and `web_resources`; it does not render the top-level `recommendations` or `explanations` fields returned by the API. See [roadmap/page.tsx](./frontend/app/roadmap/page.tsx).
- **The graph finalizer does not receive the evaluation object.** The orchestrator's initial graph state includes the difficulty level, but not an `evaluation` field. The finalizer therefore uses the explanation generator's default difficulty, `intermediate`, when making its per-step explanations. The separate explanation call does receive the real evaluation result, but the frontend does not display that top-level list.
- **Fallback quiz questions can affect the score.** If Groq fails to generate valid MCQs, the assessment agent returns sample questions with answer index `0` as the correct answer for every question. The submitted score is then calculated against those fallback answers. See [learner_understanding.py](./backend/agents/learner_understanding.py).
- **The query safety filter is a keyword-pattern check.** It checks configured terms rather than performing a broad semantic safety analysis. See [safety.py](./backend/agents/safety.py).
- **Groq is required for backend startup.** The Groq client raises an error at import time if `GROQ_API_KEY` is missing. The model defaults to `llama-3.3-70b-versatile` and can be changed with `GROQ_MODEL`. YouTube and Tavily keys are needed for their respective retrieval features. See [llm_client.py](./backend/services/llm_client.py), [content.py](./backend/agents/content.py), and [nodes.py](./backend/xagent/nodes.py).
