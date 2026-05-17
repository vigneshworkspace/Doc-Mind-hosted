"""
YouTube Cookie Generator using Playwright
Generates cookies to bypass IP-based blocking from cloud providers
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Optional
from playwright.async_api import async_playwright, Browser, Page, Playwright

COOKIE_FILE = Path("/app/youtube_cookies.json")


class CookieGenerator:
    """Generate YouTube cookies using Playwright headless browser"""
    
    def __init__(self, cookie_path: Path = COOKIE_FILE):
        self.cookie_path = cookie_path
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
    
    async def initialize(self):
        """Initialize Playwright and launch browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        )
        self.page = await self.browser.new_page()
    
    async def close(self):
        """Close browser and Playwright"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def generate_cookies(self, video_url: str = "https://www.youtube.com") -> dict:
        """
        Navigate to YouTube and extract cookies
        This simulates a real browser session to get valid cookies
        """
        if not self.page:
            await self.initialize()
        
        try:
            # Navigate to YouTube video page
            await self.page.goto(video_url, wait_until="networkidle", timeout=30000)
            
            # Wait for page to fully load
            await self.page.wait_for_timeout(2000)
            
            # Get all cookies
            cookies = await self.page.context.cookies()
            
            # Save cookies to file
            self.cookie_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cookie_path, 'w') as f:
                json.dump(cookies, f, indent=2)
            
            return {
                "success": True,
                "cookie_count": len(cookies),
                "cookies_saved": str(self.cookie_path)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_cookies(self) -> list:
        """Load cookies from file"""
        if self.cookie_path.exists():
            with open(self.cookie_path, 'r') as f:
                return json.load(f)
        return []


async def generate_youtube_cookies(video_url: str = "https://www.youtube.com/watch?v=dQw4w9WgXcQ") -> dict:
    """Main function to generate YouTube cookies"""
    generator = CookieGenerator()
    try:
        await generator.initialize()
        result = await generator.generate_cookies(video_url)
        return result
    finally:
        await generator.close()


if __name__ == "__main__":
    result = asyncio.run(generate_youtube_cookies())
    print(json.dumps(result, indent=2))
