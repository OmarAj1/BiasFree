# AI Agent Instructions (BiasFree)

When operating on this repository, you **MUST** follow these structural constraints:

1. **Zero APIs Constraint**: Do not instruct the user to set up OpenAI, Gemini, or other paid APIs. The application relies entirely on an offline Python scraping pipeline and local word lists (`data/lexicon.csv`).
2. **No Live Backend**: Do not create or run an Express/Node backend to fetch news. News fetching and bias analyzing are executed by the `.github/workflows/run.yml` worker.
3. **The Static Contract**: The React frontend must exclusively consume `data/daily-slider.json`. Do not implement CORS, database proxies, or live fetching mechanisms.
4. **Scraping Code Language**: The scraper is exclusively handled in `scraper.py`. Do not attempt to migrate parsing to the UI using NodeJS tools due to browser constraints and CORS.

Follow these rules for all future edits unless the user explicitly requests moving away from the "Ghost Worker / Zero API" methodology.
