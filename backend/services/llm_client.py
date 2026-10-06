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
    model_name: str = Config.GROQ_MODEL,
) -> str:
    """Send a prompt to the configured Groq chat-completions model."""
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
    except Exception as exc:
        raise RuntimeError(f"Groq API call failed: {exc}") from exc