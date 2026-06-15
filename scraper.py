import urllib.parse
import urllib.request
import re
import csv
import json
import os
import time
from datetime import datetime, timedelta
from newspaper import Article, Config
from collections import Counter

# --- 1. LOAD DATASETS ---
loaded_words = []
try:
    with open("data/lexicon.csv", "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if "word" in row:
                loaded_words.append(row["word"])
except Exception as e:
    print(f"Error loading lexicon: {e}")

bias_map = {}
try:
    with open("data/sources.csv", "r", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            if "news_source" in row and "rating" in row:
                n = row["news_source"].lower().strip()
                n = re.sub(r'\s*\(.*?\)\s*', '', n)
                n = n.replace(' - news', '').replace(' online news', '').replace('.com', '').replace(' news', '')
                bias_map[n.strip()] = row["rating"].lower().strip()
except Exception as e:
    print(f"Error loading sources: {e}")

# --- 2. HIGHLIGHT FUNCTION ---
def highlight_bias(text, category):
    if not text: return ""
    for word in loaded_words:
        pattern = r'\b(' + re.escape(word) + r')\b'
        class_name = f"highlight-bias highlight-bias-{category.replace('-center', '').replace('far-', '')}"
        text = re.sub(pattern, rf"<span class='{class_name}'>\1</span>", text, flags=re.IGNORECASE)
    return text

# --- 3. BING SEARCH SCRAPER ---
def get_trending_topics():
    # Fetch top news from Bing RSS
    try:
        req = urllib.request.Request('https://www.bing.com/news/search?format=rss', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            xml_data = response.read().decode('utf-8')
        items = re.findall(r'<item>([\s\S]*?)</item>', xml_data, re.IGNORECASE)
        topics = []
        for i in items:
            title_match = re.search(r'<title>(.*?)</title>', i, re.IGNORECASE)
            if title_match:
                title = title_match.group(1).replace('<![CDATA[', '').replace(']]>', '')
                # Extract key nouns to form a topic
                words = re.sub(r'[^\w\s]', '', title).split()
                if len(words) > 3:
                    topics.append(" ".join(words[:5]))
        return topics[:5]
    except Exception as e:
        print(f"Error fetching trending topics: {e}")
        return ["Economy", "Election", "Healthcare"]

def search_topic_articles(topic):
    query = urllib.parse.quote(topic)
    search_rss = f'https://www.bing.com/news/search?q={query}&format=rss'
    articles_found = []
    try:
        req = urllib.request.Request(search_rss, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            xml_data = response.read().decode('utf-8')
        items = re.findall(r'<item>([\s\S]*?)</item>', xml_data, re.IGNORECASE)
        
        for i in items:
            title_match = re.search(r'<title>(.*?)</title>', i, re.IGNORECASE)
            link_match = re.search(r'<link>(.*?)</link>', i, re.IGNORECASE)
            source_match = re.search(r'<News:Source>(.*?)</News:Source>', i, re.IGNORECASE)
            
            if title_match and link_match and source_match:
                s_raw = source_match.group(1).replace('<![CDATA[', '').replace(']]>', '')
                c = s_raw.lower().strip().replace(' on msn', '').replace(' on yahoo', '').replace(' news', '')
                
                m = None
                if c in bias_map:
                    m = bias_map[c]
                else:
                    for k, v in bias_map.items():
                        if k in c or c in k:
                            m = v
                            break
                            
                if m:
                    articles_found.append({
                        'title': title_match.group(1).replace('<![CDATA[', '').replace(']]>', ''),
                        'url': link_match.group(1).replace('<![CDATA[', '').replace(']]>', ''),
                        'source': s_raw,
                        'bias': m
                    })
    except Exception as e:
        print(f"Error searching for topic {topic}: {e}")
    return articles_found

# --- 4. EXECUTE ---
print("Starting BiasFree Smart Scraper...")
topics = get_trending_topics()
print(f"Trending topics found: {topics}")

newspaper_config = Config()
newspaper_config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
newspaper_config.request_timeout = 8

def fetch_article_text(url):
    try:
        article = Article(url, config=newspaper_config)
        article.download()
        article.parse()
        return article.text
    except Exception:
        return ""

mapping = {
    "left": "farLeftText",
    "left-center": "centerLeftText",
    "center": "centerText",
    "right-center": "centerRightText",
    "right": "farRightText",
    "allsides": "centerText"
}

output_data = []

for topic in topics:
    print(f"Searching articles for: {topic}")
    articles = search_topic_articles(topic)
    
    # Store the best article per bias
    category_articles = {}
    for a in articles:
        if a['bias'] not in category_articles:
            category_articles[a['bias']] = a
            
    if len(category_articles) >= 3: # Need at least 3 perspectives
        print(f"Found {len(category_articles)} perspectives for topic.")
        
        final_data = {
            "id": hash(topic) % 10000000,
            "date": datetime.today().strftime('%Y-%m-%d'),
            "topic": topic,
            "match_score": len(category_articles) / 5.0,
            "articles": category_articles,
            "farLeftText": "No article found in this category for this topic.",
            "centerLeftText": "No article found in this category for this topic.",
            "centerText": "No article found in this category for this topic.",
            "centerRightText": "No article found in this category for this topic.",
            "farRightText": "No article found in this category for this topic."
        }
        
        has_content = False
        for bias_key, article_info in category_articles.items():
            text = fetch_article_text(article_info['url'])
            if text and len(text) > 300:
                json_key = mapping.get(bias_key)
                if json_key:
                    final_data[json_key] = highlight_bias(text, bias_key)
                    has_content = True
        
        if has_content:
            output_data.append(final_data)

# Ensure output directory exists
os.makedirs("data", exist_ok=True)

if output_data:
    history_file = "data/daily-slider-history.json"
    history = []
    
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            pass
            
    history.extend(output_data)
    
    # Deduplicate history based on topic and date combinations
    seen_history = set()
    deduped_history = []
    for item in history:
        sig = f"{item['date']}-{item['topic']}"
        if sig not in seen_history:
            seen_history.add(sig)
            deduped_history.append(item)
    
    history = deduped_history
    cutoff_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    history = [item for item in history if item.get("date", "") >= cutoff_date]
    
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    
    with open("data/daily-slider.json", "w", encoding="utf-8") as file:
        json.dump(output_data, file, indent=2)

    print(f"\n--- Scraped, Aggregated, and Highlighted {len(output_data)} Topics Complete ---")
    print("Results saved to data/daily-slider.json")
else:
    print("\n--- Failed to scrape complete cross-partisan data for any topic. ---")



