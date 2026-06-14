import feedparser
from newspaper import Article
import json
import csv
import re
from datetime import datetime
import os

# --- 1. LOAD DATASETS ---
sources = []
try:
    with open("data/sources.csv", "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            sources.append(row)
except Exception as e:
    print(f"Error loading sources: {e}")

loaded_words = []
try:
    with open("data/lexicon.csv", "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if "word" in row:
                loaded_words.append(row["word"])
except Exception as e:
    print(f"Error loading lexicon: {e}")

# --- 2. HIGHLIGHT FUNCTION ---
def highlight_bias(text, category):
    for word in loaded_words:
        pattern = r'\b(' + re.escape(word) + r')\b'
        class_name = f"highlight-bias highlight-bias-{category.replace('-center', '')}"
        text = re.sub(pattern, rf"<span class='{class_name}'>\1</span>", text, flags=re.IGNORECASE)
    return text

# --- 3. FETCH AND EXTRACT ---
articles_data = {"left": [], "left-center": [], "center": [], "right-center": [], "right": []}

for source in sources:
    feed_url = source.get("feed_url") or source.get("url")
    if not feed_url:
        continue 
        
    raw_bias = source.get("rating", "center").lower().strip()
    if raw_bias == "left": bias = "left"
    elif raw_bias == "left-center": bias = "left-center"
    elif raw_bias == "right-center": bias = "right-center"
    elif raw_bias == "right": bias = "right"
    else: bias = "center"
    
    try:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries[:5]: # Take a few from each source
            try:
                article = Article(entry.link)
                article.download()
                article.parse()
                text = article.text
                if len(text) > 300:
                    articles_data[bias].append({
                        "title": entry.title,
                        "content": highlight_bias(text, bias)
                    })
            except Exception:
                continue
    except Exception:
        continue

def get_keywords(title):
    stop_words = {"the", "a", "an", "and", "or", "but", "in", "on", "to", "with", "for", "of", "is", "at", "by"}
    return set(title.lower().split()) - stop_words

def get_best_match(category, main_keywords):
    if not articles_data[category]:
        return {"content": f"No {category} articles scraped today.", "title": ""}
    return max(articles_data[category], key=lambda x: len(get_keywords(x["title"]).intersection(main_keywords)))

output_data = []

if articles_data["center"]:
    # Parse up to 15 stories
    for main_story in articles_data["center"][:15]:
        main_keywords = get_keywords(main_story["title"])

        final_output = {
            "date": datetime.today().strftime('%Y-%m-%d'),
            "topic": main_story["title"],
            "farLeftText": get_best_match("left", main_keywords)["content"],
            "centerLeftText": get_best_match("left-center", main_keywords)["content"],
            "centerText": main_story["content"],
            "centerRightText": get_best_match("right-center", main_keywords)["content"],
            "farRightText": get_best_match("right", main_keywords)["content"]
        }
        output_data.append(final_output)

    os.makedirs("data", exist_ok=True)
    with open("data/daily-slider.json", "w", encoding="utf-8") as file:
        json.dump(output_data, file, indent=2)

    print(f"Daily news successfully scraped, matched, and highlighted! ({len(output_data)} articles)")
else:
    print("Scraping completed, but missing center articles. Verify feed_urls.")
