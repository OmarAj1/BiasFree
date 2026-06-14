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
                source_name = row["news_source"].lower().strip()
                # Clean up known AllSides suffixes
                source_name = re.sub(r'\s*\(.*?\)\s*', '', source_name)
                source_name = source_name.replace(" - news", "").replace(" online news", "").replace(".com", "").replace(" news", "")
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
    import urllib.request
    grouped_entries = {"left": [], "left-center": [], "center": [], "right-center": [], "right": []}
    
    def fetch_query(q):
        query_url = f"https://www.bing.com/news/search?q={urllib.parse.quote(q)}&format=rss"
        req = urllib.request.Request(query_url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req) as response:
                xml_data = response.read().decode('utf-8')
        except Exception:
            return

        items = re.findall(r'<item>([\s\S]*?)</item>', xml_data, re.IGNORECASE)
        for item in items:
            source_match = re.search(r'<News:Source>(.*?)</News:Source>', item, re.IGNORECASE)
            url_match = re.search(r'url=(https?%3A%2F%2F[^&<]+)', item, re.IGNORECASE)
            if not source_match or not url_match:
                continue
                
            source_title = source_match.group(1).lower().replace(" on msn", "").replace(" on yahoo", "").replace(" news", "").strip()
            article_url = urllib.parse.unquote(url_match.group(1))
            
            matched_bias = None
            if source_title in bias_map:
                matched_bias = bias_map[source_title]
            else:
                for known_source, bias in bias_map.items():
                    if known_source in source_title or source_title in known_source:
                        matched_bias = bias
                        break
            
            if matched_bias and article_url not in grouped_entries[matched_bias]:
                grouped_entries[matched_bias].append(article_url)

    # 1. Base topic query
    fetch_query(topic)
    
    # 2. Add perspective queries if buckets are empty
    if not grouped_entries["left"]:
        fetch_query(f"{topic} MSNBC")
    if not grouped_entries["left-center"]:
        fetch_query(f"{topic} CNN")
    if not grouped_entries["center"]:
        fetch_query(f"{topic} Reuters")
    if not grouped_entries["right-center"]:
        fetch_query(f"{topic} Fox News")
    if not grouped_entries["right"]:
        fetch_query(f"{topic} Breitbart OR New York Post")
        
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
    has_any = False
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
                    has_any = True
                    break # Move to next category
            except Exception as e:
                print(f"Skipping link {link} due to error: {e}")
                continue
                
    if not has_center:
        final_data["centerText"] = "Neutral baseline article could not be scraped for this topic. Check other perspectives."

    # We include topics where we successfully pulled at least one article
    if has_any:
        output_data.append(final_data)
        print(" -> Successfully aggregated perspectives.")
    else:
        print(" -> Skipped: Could not find/parse any valid articles.")

# Ensure output directory exists
os.makedirs("data", exist_ok=True)

if output_data:
    with open("data/daily-slider.json", "w", encoding="utf-8") as file:
        json.dump(output_data, file, indent=2)
    print(f"\n--- Scraped, Aggregated, and Highlighted {len(output_data)} Topics Complete ---")
    print("Results saved to data/daily-slider.json")
else:
    print("\n--- Failed to scrape complete cross-partisan data for any topic. ---")

