"""
Gemini API Key Manager with rotation and quota tracking.
Supports multiple API keys and automatic rotation when quota is exceeded.
"""
import os
import json
from datetime import datetime, timedelta
from typing import Optional, List
from google import genai
from google.genai import errors
from .storage import get_gemini_keys_file, get_gemini_quota_file

# Default keys from environment (comma-separated)
DEFAULT_KEYS = os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", "")).split(",")

class KeyStatus:
    def __init__(self, key: str, daily_requests: int = 0, last_used: Optional[datetime] = None, 
                 quota_exceeded: bool = False, error_count: int = 0):
        self.key = key
        self.daily_requests = daily_requests
        self.last_used = last_used
        self.quota_exceeded = quota_exceeded
        self.error_count = error_count

    def to_dict(self):
        return {
            "key": self.key,
            "daily_requests": self.daily_requests,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "quota_exceeded": self.quota_exceeded,
            "error_count": self.error_count
        }

    @classmethod
    def from_dict(cls, d: dict):
        return cls(
            key=d["key"],
            daily_requests=d.get("daily_requests", 0),
            last_used=datetime.fromisoformat(d["last_used"]) if d.get("last_used") else None,
            quota_exceeded=d.get("quota_exceeded", False),
            error_count=d.get("error_count", 0)
        )

def _load_keys() -> List[KeyStatus]:
    """Load keys from file or use defaults."""
    keys = []
    keys_file = get_gemini_keys_file()
    if os.path.exists(keys_file):
        try:
            with open(keys_file, "r") as f:
                data = json.load(f)
                keys = [KeyStatus.from_dict(k) for k in data]
        except Exception:
            keys = []
    
    # If no keys file, create from environment
    if not keys and DEFAULT_KEYS and DEFAULT_KEYS[0]:
        for key in DEFAULT_KEYS:
            if key.strip():
                keys.append(KeyStatus(key=key.strip()))
        _save_keys(keys)
    
    return keys

def _save_keys(keys: List[KeyStatus]):
    """Save keys to file."""
    keys_file = get_gemini_keys_file()
    os.makedirs(os.path.dirname(keys_file), exist_ok=True)
    with open(keys_file, "w") as f:
        json.dump([k.to_dict() for k in keys], f)

def _load_quota() -> dict:
    """Load quota tracking data."""
    quota_file = get_gemini_quota_file()
    if os.path.exists(quota_file):
        try:
            with open(quota_file, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_reset": datetime.now().isoformat()}

def _save_quota(quota: dict):
    """Save quota tracking data."""
    quota_file = get_gemini_quota_file()
    os.makedirs(os.path.dirname(quota_file), exist_ok=True)
    with open(quota_file, "w") as f:
        json.dump(quota, f)

def _reset_daily_quota_if_needed(keys: List[KeyStatus]):
    """Reset daily quota at midnight."""
    quota = _load_quota()
    last_reset = datetime.fromisoformat(quota.get("last_reset", datetime.now().isoformat()))
    
    if datetime.now().date() > last_reset.date():
        # New day - reset all daily counts and quota flags
        for key in keys:
            key.daily_requests = 0
            key.quota_exceeded = False
        _save_keys(keys)
        quota["last_reset"] = datetime.now().isoformat()
        _save_quota(quota)

def get_available_key() -> Optional[str]:
    """
    Get an available API key that hasn't exceeded quota.
    Returns None if no keys are available.
    """
    keys = _load_keys()
    _reset_daily_quota_if_needed(keys)
    
    if not keys:
        return None
    
    # Sort by least recently used and lowest request count
    available = [k for k in keys if not k.quota_exceeded]
    if not available:
        return None
    
    # Pick key with fewest requests
    available.sort(key=lambda k: (k.daily_requests, k.last_used or datetime.min))
    selected = available[0]
    
    # Update last used
    selected.last_used = datetime.now()
    selected.daily_requests += 1
    _save_keys(keys)
    
    return selected.key

def mark_key_success(key: str):
    """Mark a key as successfully used."""
    keys = _load_keys()
    for k in keys:
        if k.key == key:
            k.error_count = 0
            break
    _save_keys(keys)

def mark_key_quota_exceeded(key: str):
    """Mark a key as having exceeded its quota."""
    keys = _load_keys()
    for k in keys:
        if k.key == key:
            k.quota_exceeded = True
            k.daily_requests = 9999  # Prevent selection
            break
    _save_keys(keys)
    print(f"[GeminiKeyManager] Key quota exceeded, marked as unavailable: {key[:10]}...")

def mark_key_error(key: str):
    """Mark a key as having an error (for tracking)."""
    keys = _load_keys()
    for k in keys:
        if k.key == key:
            k.error_count += 1
            if k.error_count >= 3:
                # Temporarily mark as quota exceeded after 3 consecutive errors
                k.quota_exceeded = True
                print(f"[GeminiKeyManager] Key has 3 errors, marking as unavailable: {key[:10]}...")
            break
    _save_keys(keys)

def get_key_status() -> List[dict]:
    """Get status of all keys."""
    keys = _load_keys()
    _reset_daily_quota_if_needed(keys)
    return [
        {
            "key": k.key[:10] + "...",
            "daily_requests": k.daily_requests,
            "quota_exceeded": k.quota_exceeded,
            "last_used": k.last_used.isoformat() if k.last_used else None
        }
        for k in keys
    ]

def add_key(api_key: str):
    """Add a new API key."""
    keys = _load_keys()
    # Check if key already exists
    if not any(k.key == api_key for k in keys):
        keys.append(KeyStatus(key=api_key))
        _save_keys(keys)
        print(f"[GeminiKeyManager] Added new key: {api_key[:10]}...")

def remove_key(api_key: str):
    """Remove an API key."""
    keys = _load_keys()
    keys = [k for k in keys if k.key != api_key]
    _save_keys(keys)
    print(f"[GeminiKeyManager] Removed key: {api_key[:10]}...")
