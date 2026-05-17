"""
FastAPI endpoints for YouTube Transcript service
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from app.youtube_transcript.service import youtube_service


router = APIRouter(prefix="/api/v1/youtube", tags=["youtube"])


class TranscriptRequest(BaseModel):
    """Request model for fetching transcript"""
    video_url: str
    languages: Optional[List[str]] = ["en"]
    translate_to: Optional[str] = None
    format_type: str = "text"  # text, json, srt, raw


class TranscriptResponse(BaseModel):
    """Response model for transcript data"""
    success: bool
    video_id: Optional[str] = None
    language: Optional[str] = None
    language_code: Optional[str] = None
    is_generated: Optional[bool] = None
    snippet_count: Optional[int] = None
    transcript: Optional[str] = None
    format: Optional[str] = None
    error: Optional[str] = None


@router.post("/transcript", response_model=TranscriptResponse)
async def get_transcript(request: TranscriptRequest):
    """
    Fetch transcript for a YouTube video.
    
    - **video_url**: YouTube URL or video ID
    - **languages**: Preferred languages (e.g., ["en", "de"])
    - **translate_to**: Language code to translate to
    - **format_type**: Output format - "text", "json", "srt", or "raw"
    """
    result = await youtube_service.get_transcript(
        video_url=request.video_url,
        languages=request.languages,
        translate_to=request.translate_to,
        format_type=request.format_type
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/transcript/{video_id_or_url}")
async def get_transcript_get(
    video_id_or_url: str,
    languages: Optional[str] = Query("en", description="Comma-separated languages"),
    translate_to: Optional[str] = Query(None, description="Language to translate to"),
    format_type: str = Query("text", description="Output format: text, json, srt, raw")
):
    """
    Fetch transcript for a YouTube video (GET method).
    
    - **video_id_or_url**: YouTube URL or video ID
    - **languages**: Comma-separated preferred languages (e.g., "en,de")
    - **translate_to**: Language code to translate to
    - **format_type**: Output format - "text", "json", "srt", or "raw"
    """
    lang_list = [lang.strip() for lang in languages.split(",")]
    
    result = await youtube_service.get_transcript(
        video_url=video_id_or_url,
        languages=lang_list,
        translate_to=translate_to,
        format_type=format_type
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/list/{video_id_or_url}")
async def list_transcripts(video_id_or_url: str):
    """
    List all available transcripts for a YouTube video.
    
    - **video_id_or_url**: YouTube URL or video ID
    """
    result = await youtube_service.list_available_transcripts(video_id_or_url)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/info/{video_id_or_url}")
async def get_video_info(video_id_or_url: str):
    """
    Get basic video information from URL.
    
    - **video_id_or_url**: YouTube URL or video ID
    """
    # If it's just a video ID, construct the full URL
    if not video_id_or_url.startswith("http"):
        video_id_or_url = f"https://www.youtube.com/watch?v={video_id_or_url}"
    
    result = await youtube_service.get_video_info(video_id_or_url)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "youtube_transcript"}


@router.post("/generate-cookies")
async def generate_cookies(video_url: str = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"):
    """
    Generate YouTube cookies using Playwright headless browser.
    This helps bypass IP-based blocking from cloud providers.
    
    - **video_url**: YouTube URL to navigate to (default: Rick Roll)
    """
    try:
        from app.youtube_transcript.cookie_generator import generate_youtube_cookies
        result = await generate_youtube_cookies(video_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

