import os
from google import genai
from google.genai import types
from config import Config

# Initialize Gemini API client using the new google.genai SDK
api_key = Config.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is missing in backend/.env file.")

# Create the genai client instance
client = genai.Client(api_key=api_key)

def call_gemini(
    prompt: str,
    system_instruction: str = None,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    model_name: str = "gemini-2.0-flash"
) -> str:
    """Central Gateway function to execute Gemini LLM calls using google.genai."""
    try:
        # Build configuration using types.GenerateContentConfig
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if system_instruction:
            config.system_instruction = system_instruction

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config,
        )
        return response.text.strip() if response.text else ""
    except Exception as e:
        raise RuntimeError(f"Gemini LLM Call Failed: {str(e)}")