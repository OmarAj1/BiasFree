# BiasFree: Serverless News Architecture

## Developer & AI Entity Blueprint

This document explains the technical paradigm of the **BiasFree** architecture. If you are an AI assistant, an open-source contributor, or an agent continuing development on this repository, **you must read and adhere to the architectural constraints outlined here.**

### 1. The Core Philosophy ("Bulletproof Setup")
BiasFree operates on a **100% serverless, zero-API** architecture.
- **Zero Paid APIs**: We do not use dynamic LLMs (Gemini, ChatGPT) for real-time text analysis in order to eliminate cost and latency.
- **Ghost Worker Paradigm**: Instead of an active node.js backend server handling HTTP requests, data processing occurs entirely offline inside a GitHub Action `.github/workflows/run.yml`.
- **Static Artifacts**: The backend's sole job is to produce a flat JSON file (`data/daily-slider.json`) which is served statically to the React frontend.

### 2. The Data Pipeline
The entire process is automated via `scraper.py`, which is triggered by a cron job every morning at 6:00 AM.
1. **Source Loading**: Reads `data/sources.csv`, which holds a list of news outlets (Left, Right, Center).
2. **Lexicon Matching**: Reads `data/lexicon.csv`, a massive repository of emotional or loaded adjectives.
3. **Fetching**: `feedparser` traverses the RSS feeds of the news outlets.
4. **Extraction & Injection**: `newspaper3k` strips UI/Ads from the articles. The script then applies a Regex substitution to wrap all loaded lexicon words in an HTML `<span class="highlight-bias">` tag.
5. **Cross-Referencing**: Using a simple set-intersection NLP algorithm, it pairs one Center story with the most topically similar Left and Right counterpart. 
6. **Publishing**: The results are dumped into `data/daily-slider.json` and committed automatically back to the repository via the GitHub Action.

### 3. How to Edit and Test This Setup
If you are an "Other Entity" aiming to enhance this platform:

* **CRITICAL RULE**: Do not manually commit or push `data/daily-slider.json` or `data/daily-slider-history.json` to the repository. These files are ignored locally by `.gitignore` and must only be generated, updated, and committed automatically by the "Daily News Ghost Worker" GitHub Action.
* **Testing Locally**: You can manually trigger the worker. Just run `python scraper.py` in your terminal. It will immediately generate a fresh `data/daily-slider.json` for local validation. Make sure you run `pip install feedparser newspaper3k` first!
* **Testing via GitHub Actions**: Go to the "Actions" tab in your GitHub repository, click on "Daily News Ghost Worker" and click "Run workflow" to force a manual scrape right now, without waiting an hour.
* **The Smart Google News Pipeline**: The scraper automatically parses all 500+ news labels in `data/sources.csv`. It fetches the #1 trending topic via Google News, then searches that exact topic *again* through Google News to isolate articles precisely mapped to your Left, Right, and Center sources. This ensures the articles align flawlessly!
