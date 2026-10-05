import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    MONGO_URI = os.getenv("MONGO_URI")
    JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-default-key")
    ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")