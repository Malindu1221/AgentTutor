import sqlite3
import json
from services.llm_client import call_gemini
from utils.json_utils import extract_and_parse_json
import os
import requests

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

DB_PATH = "sessions.db"

def search_cache(keyword: str):
    """Checks SQLite resources table for cached recommendations."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT data FROM resources WHERE keyword = ?", (keyword.lower(),))
        row = cursor.fetchone()
        conn.close()
        if row:
            return json.loads(row[0])
    except Exception:
        pass
    return None

def recommend_content(step_items: list, domain: str, difficulty: str, limit: int = 3) -> dict:
    """Generates resource recommendations for roadmap steps."""
    recommendations = {}

    for step in step_items:
        title = step.get("title", "")
        cached = search_cache(title)
        if cached:
            recommendations[title] = cached
            continue

        system_instruction = (
            f"Recommend {limit} high-quality educational resources for learning '{title}' "
            f"in domain '{domain}' at '{difficulty}' level. "
            "Return ONLY a JSON array of objects with keys: "
            "\"title\", \"url\", \"description\", \"tags\" (array of strings)."
        )
        prompt = f"Step: {title}"

        try:
            response = call_gemini(prompt, system_instruction=system_instruction, max_tokens=500)
            res = extract_and_parse_json(response)
            if isinstance(res, list):
                recommendations[title] = res
                continue
        except Exception:
            pass

        # Fallback Search Links
        safe_term = title.replace(" ", "+")
        recommendations[title] = [
            {"title": f"Google Search: {title}", "url": f"https://www.google.com/search?q={safe_term}", "description": f"Curated web articles for {title}", "tags": [domain]},
            {"title": f"YouTube Tutorials: {title}", "url": f"https://www.youtube.com/results?search_query={safe_term}", "description": f"Video walkthroughs for {title}", "tags": ["video", domain]}
        ]
        


def fetch_youtube_resources(topic: str, max_results: int = 2) -> list:
    """Searches the YouTube Data API for relevant video tutorials."""
    if not YOUTUBE_API_KEY:
        print("[Content Agent] Warning: YOUTUBE_API_KEY missing, skipping retrieval.")
        return []

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": f"{topic} tutorial",
        "type": "video",
        "maxResults": max_results,
        "key": YOUTUBE_API_KEY
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        resources = []
        for item in data.get("items", []):
            video_id = item["id"].get("videoId")
            title = item["snippet"].get("title")
            if video_id:
                resources.append({
                    "title": title,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "type": "youtube_video"
                })
        return resources
    except Exception as e:
        print(f"[Content Agent] YouTube API Error: {e}")
        return []   
        
        
        

    return recommendations