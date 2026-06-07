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

# A key that hits a quota/rate error is put on a short cooldown rather than being
# permanently disabled until midnight. This lets a transient 429 — or a 429 caused
# by one unavailable model — heal on its own instead of bricking the key for every
# model. During the cooldown window, get_provider_with_fallback routes to the next
# provider (groq/nvidia/ollama).
KEY_COOLDOWN_SECONDS = int(os.getenv("GEMINI_KEY_COOLDOWN_SECONDS", "600"))  # 10 min


def _cooldown_until():
    # Jitter so a correlated 429 burst doesn't put every key on the same cooldown
    # clock and leave a window with zero available keys.
    import random
    return datetime.now() + timedelta(seconds=KEY_COOLDOWN_SECONDS * random.uniform(0.6, 1.4))

class KeyStatus:
    def __init__(self, key: str, daily_requests: int = 0, last_used: Optional[datetime] = None,
                 quota_exceeded: bool = False, error_count: int = 0,
                 cooldown_until: Optional[datetime] = None):
        self.key = key
        self.daily_requests = daily_requests
        self.last_used = last_used
        self.quota_exceeded = quota_exceeded  # informational only; availability is gated by cooldown_until
        self.error_count = error_count
        self.cooldown_until = cooldown_until

    def is_available(self, now: Optional[datetime] = None) -> bool:
        now = now or datetime.now()
        return self.cooldown_until is None or now >= self.cooldown_until

    def to_dict(self):
        return {
            "key": self.key,
            "daily_requests": self.daily_requests,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "quota_exceeded": self.quota_exceeded,
            "error_count": self.error_count,
            "cooldown_until": self.cooldown_until.isoformat() if self.cooldown_until else None,
        }

    @classmethod
    def from_dict(cls, d: dict):
        return cls(
            key=d["key"],
            daily_requests=d.get("daily_requests", 0),
            last_used=datetime.fromisoformat(d["last_used"]) if d.get("last_used") else None,
            quota_exceeded=d.get("quota_exceeded", False),
            error_count=d.get("error_count", 0),
            cooldown_until=datetime.fromisoformat(d["cooldown_until"]) if d.get("cooldown_until") else None,
        )

_boot_cleared = False


def _load_keys() -> List[KeyStatus]:
    """Load keys, reconciled against the environment.

    Env (GEMINI_API_KEYS) is authoritative for the key SET: keys present in the file
    but absent from env are dropped (rotated-out keys don't linger), and env keys
    missing from the file are added. Counters/cooldowns are carried over from the file
    as a best-effort cache. On first load per process, stale cooldowns are cleared so a
    restart doesn't inherit a suppressed key from a previous run.
    """
    global _boot_cleared
    file_keys: dict[str, KeyStatus] = {}
    keys_file = get_gemini_keys_file()
    if os.path.exists(keys_file):
        try:
            with open(keys_file, "r") as f:
                for k in json.load(f):
                    ks = KeyStatus.from_dict(k)
                    file_keys[ks.key] = ks
        except Exception:
            file_keys = {}

    env_keys = [k.strip() for k in DEFAULT_KEYS if k.strip()]
    if env_keys:
        keys = [file_keys.get(k) or KeyStatus(key=k) for k in env_keys]
    else:
        keys = list(file_keys.values())

    if not _boot_cleared:
        for k in keys:
            k.cooldown_until = None
            k.quota_exceeded = False
        _boot_cleared = True
        if keys:
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

    # Available = not currently on cooldown. Cooldowns expire on their own, so a
    # key that hit a transient/model-specific 429 recovers without manual reset.
    now = datetime.now()
    available = [k for k in keys if k.is_available(now)]
    if not available:
        return None
    
    # Pick key with fewest requests
    available.sort(key=lambda k: (k.daily_requests, k.last_used or datetime.min))
    selected = available[0]
    
    # Update last used (count incremented on success, not checkout)
    selected.last_used = datetime.now()
    _save_keys(keys)
    
    return selected.key

def mark_key_success(key: str):
    """Mark a key as successfully used."""
    keys = _load_keys()
    for k in keys:
        if k.key == key:
            k.error_count = 0
            k.cooldown_until = None
            k.quota_exceeded = False
            k.daily_requests += 1
            break
    _save_keys(keys)

def mark_key_quota_exceeded(key: str):
    """Put a key on cooldown after a quota/rate-limit error.

    Cooldown (not a permanent flag) so the key auto-recovers — a 429 from a single
    unavailable model must not disable the key for every other model until midnight.
    """
    keys = _load_keys()
    for k in keys:
        if k.key == key:
            k.quota_exceeded = True
            k.cooldown_until = _cooldown_until()
            break
    _save_keys(keys)
    print(f"[GeminiKeyManager] Key on cooldown {KEY_COOLDOWN_SECONDS}s after quota/rate error: {key[:10]}...")

def mark_key_error(key: str):
    """Mark a key as having an error (for tracking)."""
    keys = _load_keys()
    for k in keys:
        if k.key == key:
            k.error_count += 1
            if k.error_count >= 3:
                # Cooldown after 3 consecutive errors (auto-recovers, not permanent)
                k.cooldown_until = _cooldown_until()
                print(f"[GeminiKeyManager] Key has 3 errors, cooling down {KEY_COOLDOWN_SECONDS}s: {key[:10]}...")
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
