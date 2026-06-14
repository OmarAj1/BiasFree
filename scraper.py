import feedparser
from newspaper import Article
import json
import csv
import re
from datetime import datetime
import os
import urllib.parse
import time

# --- 1. LOAD DATASETS ---
# Load the sources CSV to map publisher names to their bias rating
bias_map = {}
try:
    with open("data/sources.csv", "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if "news_source" in row and "rating" in row:
                # Clean and lower for better matching
                source_name = row["news_source"].lower().strip()
                # Remove common prefixes/suffixes for matching
                source_name = source_name.replace(" - news", "").replace(" online news", "").replace(".com", "")
                bias_map[source_name.strip()] = row["rating"].lower().strip()
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
# Finds any loaded word in the text and wraps it in a red HTML tag
def highlight_bias(text, category):
    for word in loaded_words:
        # Regex \b ensures we only match whole words, case-insensitive
        pattern = r'\b(' + re.escape(word) + r')\b'
        # Add dynamic class based on the bias category
        class_name = f"highlight-bias highlight-bias-{category.replace('-center', '')}"
        text = re.sub(pattern, rf"<span class='{class_name}'>\1</span>", text, flags=re.IGNORECASE)
    return text

# --- 3. GOOGLE NEWS TOPIC PIPELINE ---
def get_top_google_news_topics(limit=15):
    # Fetch top US news from Google
    top_news_rss = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(top_news_rss)
    if not feed.entries:
        return []
    
    topics = []
    # Deduplicate loosely similar titles
    for entry in feed.entries:
        title = entry.title.rsplit(" - ", 1)[0]
        if title not in topics:
            topics.append(title)
        if len(topics) >= limit:
            break
            
    return topics

def search_topic_and_group(topic):
    # Encode for URL
    query = urllib.parse.quote(topic)
    # Search Google News for all articles about this specific top story
    search_rss = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(search_rss)
    
    # 5-track buckets
    grouped_entries = {"left": [], "left-center": [], "center": [], "right-center": [], "right": []}
    
    for entry in feed.entries:
        source_title = entry.source.title.lower().strip() if hasattr(entry, 'source') else ""
        
        # Match against our large source bias map
        matched_bias = None
        if source_title in bias_map:
            matched_bias = bias_map[source_title]
        else:
            # Try partial matching
            for known_source, bias in bias_map.items():
                if known_source in source_title or source_title in known_source:
                    matched_bias = bias
                    break
        
        if matched_bias and matched_bias in grouped_entries:
            grouped_entries[matched_bias].append(entry.link)
            
    return grouped_entries

# --- 4. EXECUTE ---
print("Starting BiasFree Smart Scraper...")
topics = get_top_google_news_topics(15)
if not topics:
    print("Could not fetch top news.")
    exit(1)

output_data = []

for idx, topic in enumerate(topics):
    print(f"\nProcessing Topic {idx + 1}/{len(topics)}: {topic}")
    grouped_links = search_topic_and_group(topic)
    
    final_data = {
        "date": datetime.today().strftime('%Y-%m-%d'),
        "topic": topic,
        "farLeftText": "No article found in this category for this topic.",
        "centerLeftText": "No article found in this category for this topic.",
        "centerText": "No article found in this category for this topic.",
        "centerRightText": "No article found in this category for this topic.",
        "farRightText": "No article found in this category for this topic."
    }

    mapping = {
        "left": "farLeftText",
        "left-center": "centerLeftText",
        "center": "centerText",
        "right-center": "centerRightText",
        "right": "farRightText"
    }

    has_center = False
    for cat, json_key in mapping.items():
        for link in grouped_links[cat]:
            try:
                article = Article(link)
                article.download()
                article.parse()
                text = article.text
                if len(text) > 300:
                    final_data[json_key] = highlight_bias(text, cat)
                    if cat == "center":
                        has_center = True
                    break # Move to next category
            except Exception as e:
                continue
                
    # We only include topics where we successfully pulled at least a center article
    if has_center:
        output_data.append(final_data)
        print(" -> Successfully aggregated top perspectives.")
    else:
        print(" -> Skipped: Could not find/parse a valid center article.")

# Ensure output directory exists
os.makedirs("data", exist_ok=True)

if output_data:
    with open("data/daily-slider.json", "w", encoding="utf-8") as file:
        json.dump(output_data, file, indent=2)
    print(f"\n--- Scraped, Aggregated, and Highlighted {len(output_data)} Topics Complete ---")
    print("Results saved to data/daily-slider.json")
else:
    print("\n--- Failed to scrape complete cross-partisan data for any topic. ---")

