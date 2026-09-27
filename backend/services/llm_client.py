import google.generativeai as genai
from config import Config

# Initialize Gemini API client
if Config.GEMINI_API_KEY:
    genai.configure(api_key=Config.GEMINI_API_KEY)

def call_gemini(
    prompt: str,
    system_instruction: str = None,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    model_name: str = "gemini-2.0-flash"
) -> str:
    """Central Gateway function to execute Gemini LLM calls."""
    if not Config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing in backend/.env file.")

    try:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction
        )
        generation_config = genai.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens
        )
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        return response.text.strip() if response.text else ""
    except Exception as e:
        raise RuntimeError(f"Gemini LLM Call Failed: {str(e)}")