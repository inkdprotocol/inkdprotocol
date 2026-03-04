# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## Web Scraping

### Scrapling (Python)
- **Repo:** https://github.com/D4Vinci/Scrapling
- **Docs:** https://scrapling.readthedocs.io
- **Install:** `pip install scrapling` (installed ✅)
- **When to use:** Whenever I need to scrape a website — especially if it has Cloudflare, changes layout, or needs JS rendering.

**Key classes:**
```python
from scrapling.fetchers import Fetcher, StealthyFetcher, DynamicFetcher

# Simple HTTP (fast)
p = Fetcher.get('https://example.com')

# Stealth — bypasses Cloudflare Turnstile, fingerprint spoofing
p = StealthyFetcher.fetch('https://example.com', headless=True)

# Dynamic — full browser (Playwright/Chromium), for JS-heavy pages
p = DynamicFetcher.fetch('https://example.com')

# Selection (CSS / XPath)
items = p.css('.product')
text = p.css('h1::text').get()

# Adaptive — survives website layout changes
products = p.css('.product', auto_save=True)   # first run: save fingerprint
products = p.css('.product', adaptive=True)    # later: find even if layout changed
```

**Spider API (Scrapy-style, for crawls):**
```python
from scrapling.spiders import Spider, Response

class MySpider(Spider):
    name = "demo"
    start_urls = ["https://example.com/"]
    async def parse(self, response: Response):
        for item in response.css('.product'):
            yield {"title": item.css('h2::text').get()}

MySpider().start()
```

**MCP server built-in:** `scrapling mcp` — can be used with Claude/Cursor directly.

---

Add whatever helps you do your job. This is your cheat sheet.
