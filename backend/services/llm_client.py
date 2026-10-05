from groq import Groq
from config import Config

if not Config.GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing in backend/.env file.")

client = Groq(api_key=Config.GROQ_API_KEY)


def call_groq(
    prompt: str,
    system_instruction: str = None,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    model_name: str = "openai/gpt-oss-120b",
) -> str:
    """Send a chat completion request through the Groq API."""
    try:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""
    except Exception as e:
        raise RuntimeError(f"Groq LLM Call Failed: {str(e)}") from e