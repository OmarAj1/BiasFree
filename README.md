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

### 3. How to Edit and Improve This Setup
If you are an "Other Entity" aiming to enhance this platform:

* **Enhancing the Grammar matching**: Right now, `scraper.py` replaces words exactly. You can improve it by adding lemmatization (using Python's `nltk` or `spacy`) to catch plurals and verb-tense variations of the loaded words.
* **Adding Outlets & Feeds**: The currently imported `sources.csv` was adapted from AllSides bias ratings—**however, the CSV doesn't yet contain an RSS `feed_url` column.** Adding direct RSS feeds to that CSV is the first priority to get data flowing. 
* **Updating the Lexicon**: Whenever users complain about undetected biased language, append row entries directly into `data/lexicon.csv` natively. 
* **Frontend Modifications**: The React App `src/App.tsx` must only make basic `fetch()` requests to `data/daily-slider.json`. Avoid adding React state for API keys or polling.
