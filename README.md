# AgentTutor

An AI-powered, multi-agent educational platform that generates personalized learning roadmaps and content recommendations using the Groq API and LangGraph.

## Authentication and profiles

The FastAPI backend exposes:

- `POST /api/auth/register` and `POST /api/auth/login` for email/password account registration and login.
- `GET`, `POST`, `PUT`, and `DELETE /api/profile/me` for the authenticated user's profile.
- `GET /recommendations` to retrieve that user's latest saved personalized recommendations.
- `POST /recommendations/generate` to search YouTube and Tavily, rank the results against profile fields, and persist the refreshed list.

The frontend has `/login`, `/register`, and `/profile` pages. It stores the returned bearer token in browser `localStorage` and adds it to API requests. Because JavaScript can access localStorage, production deployments should use HTTPS and protect against cross-site scripting; consider an HttpOnly-cookie setup if the authentication transport is changed later.

Configure these values in `backend/.env` before running the backend:

```dotenv
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/agenttutor?retryWrites=true&w=majority
MONGO_DB_NAME=agenttutor
JWT_SECRET=<a-random-secret-at-least-32-characters-long>
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
GROQ_API_KEY=<your-groq-api-key>
```

Add the remaining integration keys (`YOUTUBE_API_KEY` and `TAVILY_API_KEY`) if those resource-search features are enabled. Install backend dependencies from `backend/requirements.txt`. Set `NEXT_PUBLIC_API_URL` for the frontend if the API is not running at `http://127.0.0.1:8000`.

Open `/recommendations` in the frontend while signed in to view saved results or generate a new set. The recommendation ranker uses deterministic local hashing-vector embeddings over profile text and result title/description, so it does not download a separate embedding model.

Authenticated users' sessions are associated with their MongoDB user ID. Guest learning sessions remain supported. When a profile exists, its education, work history, projects, and skills are supplied as context to the personalized roadmap, explanation, and resource-recommendation generation.
