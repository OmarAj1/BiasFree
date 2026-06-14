import feedparser
from newspaper import Article
import json
import csv
import re
from datetime import datetime
import os

# --- 1. LOAD YOUR DATASETS ---
# Load the sources CSV to know which feed is left/right/center
sources = []
with open("data/sources.csv", "r", encoding="utf-8") as file:
    reader = csv.DictReader(file)
    for row in reader:
        sources.append(row)

# Load the loaded words lexicon directly from the provided CSV format
loaded_words = []
try:
    with open("data/lexicon.csv", "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if "word" in row:
                loaded_words.append(row["word"])
except FileNotFoundError:
    print("Lexicon not found, defaulting to empty list.")

# --- 2. HIGHLIGHT FUNCTION ---
# Finds any loaded word in the text and wraps it in a red HTML tag
def highlight_bias(text):
    for word in loaded_words:
        # Regex \b ensures we only match whole words, case-insensitive
        pattern = r'\b(' + re.escape(word) + r')\b'
        text = re.sub(pattern, r'<span class="highlight-bias">\1</span>', text, flags=re.IGNORECASE)
    return text

# --- 3. FETCH AND EXTRACT ---
articles_data = {"left": [], "left-center": [], "center": [], "right-center": [], "right": []}

for source in sources:
    # Note: Using 'url' or 'feed_url' based on availability. 
    # For full functionality, ensure RSS URLs exist in the sources.csv!
    feed_url = source.get("feed_url")
    if not feed_url:
        continue 
        
    # The AllSides dataset categorizes as left, left-center, center, right-center, right. 
    raw_bias = source.get("rating", "center").lower().strip()
    if raw_bias == "left": bias = "left"
    elif raw_bias == "left-center": bias = "left-center"
    elif raw_bias == "right-center": bias = "right-center"
    elif raw_bias == "right": bias = "right"
    else: bias = "center"
    
    feed = feedparser.parse(feed_url)
    
    # Grab the top 5 headlines from each feed
    for entry in feed.entries[:5]:
        try:
            # newspaper3k extracts just the article text, ignoring ads
            article = Article(entry.link)
            article.download()
            article.parse()
            
            # Highlight the biased words using our dictionary
            processed_text = highlight_bias(article.text)
            
            articles_data[bias].append({
                "title": entry.title,
                "url": entry.link,
                "content": processed_text
            })
        except Exception as e:
            # Skip if the page fails to load
            continue

# --- 4. MATCHING THE STORIES (Without AI) ---
# A simple matching algorithm: Find headlines that share the most nouns
def get_keywords(title):
    stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "to", "with", "for", "of", "is", "at", "by"}
    return set(title.lower().split()) - stop_words

def get_best_match(category, main_keywords):
    if not articles_data[category]:
        return {"content": f"No {category} articles scraped today.", "title": ""}
    return max(articles_data[category], key=lambda x: len(get_keywords(x["title"]).intersection(main_keywords)))

# Only aggregate if we actually found articles to compare
if articles_data["center"]:
    main_story = articles_data["center"][0]
    main_keywords = get_keywords(main_story["title"])

    # --- 5. EXPORT TO JSON FOR YOUR WEBSITE ---
    final_output = {
        "date": datetime.today().strftime('%Y-%m-%d'),
        "topic": main_story["title"],
        "farLeftText": get_best_match("left", main_keywords)["content"],
        "centerLeftText": get_best_match("left-center", main_keywords)["content"],
        "centerText": main_story["content"],
        "centerRightText": get_best_match("right-center", main_keywords)["content"],
        "farRightText": get_best_match("right", main_keywords)["content"]
    }

    os.makedirs("data", exist_ok=True)
    with open("data/daily-slider.json", "w", encoding="utf-8") as file:
        json.dump(final_output, file, indent=2)

    print("Daily news successfully scraped, matched, and highlighted!")
else:
    print("Scraping completed, but missing center articles. Verify feed_urls.")
