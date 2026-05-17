"""
YouTube Transcript Service for Lexi AI
Provides functionality to fetch and process YouTube video transcripts
"""
import os
import re
import json
from pathlib import Path
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import (
    YouTubeTranscriptApi as YTTApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    VideoUnplayable,
    IpBlocked,
    RequestBlocked,
    InvalidVideoId,
    AgeRestricted,
)
from youtube_transcript_api.formatters import JSONFormatter, TextFormatter, SRTFormatter

# Cookie file path for proxy cookies
COOKIE_FILE = Path(os.getenv("YOUTUBE_COOKIE_FILE", "/app/youtube_cookies.json"))


class YouTubeService:
    """Service for fetching and processing YouTube transcripts"""
    def __init__(self):
        self.api = YTTApi()
        self.json_formatter = JSONFormatter()
        self.text_formatter = TextFormatter()
        self.srt_formatter = SRTFormatter()

    def _load_cookies(self) -> list:
        """Load cookies from file if available"""
        if COOKIE_FILE.exists():
            try:
                with open(COOKIE_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def extract_video_id(self, url: str) -> Optional[str]:
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})',
            r'^([a-zA-Z0-9_-]{11})$',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def get_transcript(self, video_url: str, languages: list = None, translate_to: Optional[str] = None, format_type: str = "text") -> dict:
        if languages is None:
            languages = ['en']
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return {"success": False, "error": "Invalid YouTube URL or video ID", "video_id": None}
        
        try:
            transcript = self.api.fetch(video_id, languages=languages)
            
            if format_type == "json":
                formatted = self.json_formatter.format_transcript(transcript, indent=2)
            elif format_type == "srt":
                formatted = self.srt_formatter.format_transcript(transcript)
            else:
                formatted = self.text_formatter.format_transcript(transcript)
            return {
                "success": True,
                "video_id": video_id,
                "language": transcript.get('language', '') if isinstance(transcript, dict) else getattr(transcript, 'language', ''),
                "language_code": transcript.get('language_code', '') if isinstance(transcript, dict) else getattr(transcript, 'language_code', ''),
                "transcript": formatted,
                "format": format_type
            }
        except IpBlocked:
            return {"success": False, "error": "YouTube is blocking requests from your IP. Consider using a proxy service.", "video_id": video_id, "ip_blocked": True}
        except TranscriptsDisabled:
            return {"success": False, "error": "Subtitles are disabled for this video", "video_id": video_id}
        except NoTranscriptFound as e:
            return {"success": False, "error": f"No transcript found: {languages}", "video_id": video_id}
        except VideoUnavailable:
            return {"success": False, "error": "Video is no longer available", "video_id": video_id}
        except Exception as e:
            return {"success": False, "error": str(e), "video_id": video_id}

    async def get_video_info(self, video_url: str) -> dict:
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return {"success": False, "error": "Invalid YouTube URL or video ID"}
        return {
            "success": True,
            "video_id": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "embed_url": f"https://www.youtube.com/embed/{video_id}"
        }

    async def list_available_transcripts(self, video_url: str) -> dict:
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return {"success": False, "error": "Invalid YouTube URL or video ID"}
        try:
            transcript_list = self.api.list(video_id)
            available = [{"language": t.language, "language_code": t.language_code, "is_generated": t.is_generated} for t in transcript_list]
            return {"success": True, "video_id": video_id, "transcripts": available}
        except Exception as e:
            return {"success": False, "error": str(e)}

youtube_service = YouTubeService()
