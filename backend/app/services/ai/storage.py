import os


def get_ai_data_dir() -> str:
    override = os.getenv("AI_DATA_DIR", "").strip()
    if override:
        return os.path.abspath(override)
    return os.path.join(os.path.dirname(__file__), "data")


def get_provider_override_file() -> str:
    return os.path.join(get_ai_data_dir(), "current_provider.txt")


def get_gemini_keys_file() -> str:
    return os.path.join(get_ai_data_dir(), "gemini_keys.json")


def get_gemini_quota_file() -> str:
    return os.path.join(get_ai_data_dir(), "gemini_quota.json")
