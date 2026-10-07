from typing import Any, TypeVar

from groq import Groq
from config import Config
from pydantic import BaseModel

if not Config.GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing in backend/.env file.")

client = Groq(api_key=Config.GROQ_API_KEY)
ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


def call_groq_structured(
    prompt: str,
    response_model: type[ResponseModel],
    system_instruction: str = None,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    model_name: str = Config.GROQ_MODEL,
) -> ResponseModel:
    """Request and validate a Groq response matching a strict Pydantic schema."""
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
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": response_model.__name__.lower(),
                    "strict": True,
                    "schema": response_model.model_json_schema(),
                },
            },
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("Groq returned an empty structured response.")
        return response_model.model_validate_json(content)
    except Exception as exc:
        raise RuntimeError(f"Groq structured API call failed: {exc}") from exc


def call_groq_json(
    prompt: str,
    system_instruction: str = None,
    temperature: float = 0.2,
    max_tokens: int = 512,
    model_name: str = Config.GROQ_MODEL,
) -> str:
    """Request a JSON-object chat completion from Groq."""
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
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("Groq returned an empty JSON response.")
        return content.strip()
    except Exception as exc:
        raise RuntimeError(f"Groq JSON API call failed: {exc}") from exc


def open_groq_stream(
    prompt: str,
    system_instruction: str = None,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    model_name: str = Config.GROQ_MODEL,
) -> Any:
    """Open a streaming chat completion from the configured Groq model."""
    try:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        return client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
    except Exception as exc:
        raise RuntimeError(f"Groq API call failed: {exc}") from exc


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