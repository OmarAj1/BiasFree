import feedparser
from newspaper import Article, Config
import json
import csv
import re
from datetime import datetime, timedelta
import os
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter, defaultdict
import time

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

# --- 2. HIGHLIGHT FUNCTION ---
def highlight_bias(text, category):
    for word in loaded_words:
        pattern = r'\b(' + re.escape(word) + r')\b'
        class_name = f"highlight-bias highlight-bias-{category.replace('-center', '')}"
        text = re.sub(pattern, rf"<span class='{class_name}'>\1</span>", text, flags=re.IGNORECASE)
    return text

# --- 3. HIGH VOLUME SCRAPER ---

SOURCES = [
    {"name": "The Guardian", "url": "https://www.theguardian.com/world/rss", "bias_category": "left", "priority": 1},
    {"name": "Mother Jones", "url": "https://www.motherjones.com/feed", "bias_category": "left", "priority": 2},
    {"name": "The Nation", "url": "https://www.thenation.com/feed", "bias_category": "left", "priority": 3},
    {"name": "Jacobin", "url": "https://jacobin.com/feed", "bias_category": "left", "priority": 4},
    {"name": "The Intercept", "url": "https://theintercept.com/feed/?lang=en", "bias_category": "left", "priority": 5},
    {"name": "Democracy Now", "url": "https://www.democracynow.org/democracynow.rss", "bias_category": "left", "priority": 6},
    
    {"name": "MSNBC", "url": "https://www.msnbc.com/feeds/latest", "bias_category": "left-center", "priority": 1},
    {"name": "CNN", "url": "http://rss.cnn.com/rss/edition.rss", "bias_category": "left-center", "priority": 2},
    {"name": "Politico", "url": "https://rss.politico.com/politics-news.xml", "bias_category": "left-center", "priority": 3},
    {"name": "HuffPost", "url": "https://www.huffpost.com/section/front-page/feed", "bias_category": "left-center", "priority": 4},
    {"name": "Vox", "url": "https://www.vox.com/rss/index.xml", "bias_category": "left-center", "priority": 5},
    {"name": "The Atlantic", "url": "https://www.theatlantic.com/feed/all", "bias_category": "left-center", "priority": 6},
    
    {"name": "Reuters", "url": "https://www.reutersagency.com/feed/?best-topics=political-general&type=rx", "bias_category": "center", "priority": 1},
    {"name": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml", "bias_category": "center", "priority": 3},
    {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml", "bias_category": "center", "priority": 4},
    {"name": "PBS", "url": "https://www.pbs.org/newshour/feeds/rss/headlines", "bias_category": "center", "priority": 5},
    {"name": "The Hill", "url": "https://thehill.com/feed", "bias_category": "center", "priority": 6},
    
    {"name": "The Wall Street Journal", "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "bias_category": "right-center", "priority": 1},
    {"name": "Fox News", "url": "http://feeds.foxnews.com/foxnews/latest", "bias_category": "right-center", "priority": 2},
    {"name": "New York Post", "url": "https://nypost.com/feed", "bias_category": "right-center", "priority": 3},
    {"name": "Washington Examiner", "url": "https://www.washingtonexaminer.com/rss", "bias_category": "right-center", "priority": 4},
    {"name": "National Review", "url": "https://www.nationalreview.com/feed", "bias_category": "right-center", "priority": 5},
    
    {"name": "Breitbart", "url": "http://feeds.feedburner.com/breitbart", "bias_category": "right", "priority": 1},
    {"name": "The Federalist", "url": "https://thefederalist.com/feed", "bias_category": "right", "priority": 2},
    {"name": "Daily Wire", "url": "https://www.dailywire.com/feed", "bias_category": "right", "priority": 3},
    {"name": "InfoWars", "url": "http://feeds.feedburner.com/infowars", "bias_category": "right", "priority": 4},
    {"name": "Zero Hedge", "url": "http://feeds.feedburner.com/zerohedge", "bias_category": "right", "priority": 6},
]

class HighVolumeScraper:
    def fetch_feed(self, source):
        """Fetch single RSS feed"""
        try:
            feed = feedparser.parse(source['url'])
            articles = []
            for entry in feed.entries[:40]:  # Up to 40 per source
                articles.append({
                    'title': entry.get('title', ''),
                    'url': entry.get('link', ''),
                    'source': source['name'],
                    'bias': source['bias_category'],
                    'priority': source['priority']
                })
            return articles
        except Exception as e:
            print(f"Error fetching {source['name']}: {e}")
            return []
    
    def fetch_all(self):
        articles_by_bias = {
            'left': [], 'left-center': [], 'center': [], 
            'right-center': [], 'right': []
        }
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_source = {executor.submit(self.fetch_feed, s): s for s in SOURCES}
            for future in as_completed(future_to_source):
                source = future_to_source[future]
                try:
                    articles = future.result()
                    for article in articles:
                        if article['bias'] in articles_by_bias:
                            articles_by_bias[article['bias']].append(article)
                except Exception as e:
                    print(f"Source {source['name']} generated an exception: {e}")
                    
        return articles_by_bias

class HighVolumeMatcher:
    def __init__(self):
        self.stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'it', 'that', 'this', 'as', 'from', 'be', 'have', 'has', 'had', 'not'}
        self.keyword_boost = {
            'trump': 2.0, 'biden': 2.0, 'election': 1.5, 'congress': 1.5,
            'supreme court': 1.5, 'ukraine': 1.3, 'israel': 1.3, 'gaza': 1.3,
            'china': 1.3, 'russia': 1.3, 'economy': 1.2, 'inflation': 1.2
        }
    
    def extract_keywords(self, title):
        cleaned = re.sub(r'[^\w\s]', '', title.lower())
        words = cleaned.split()
        
        keywords = [w for w in words if w not in self.stop_words and len(w) > 3]
        
        boosted = []
        for kw in keywords:
            boost = 1.0
            for pattern, factor in self.keyword_boost.items():
                if pattern in ' '.join(keywords):
                    boost = factor
                    break
            boosted.extend([kw] * int(boost))
        
        return boosted
    
    def cluster_by_keywords(self, articles_by_bias):
        clusters = []
        
        all_articles = []
        for bias, articles in articles_by_bias.items():
            for a in articles:
                all_articles.append(a)
                
        for article in all_articles:
            kw = set(self.extract_keywords(article['title']))
            if len(kw) < 2:
                continue
            
            placed = False
            for cluster in clusters:
                ckw = cluster['core_keywords']
                intersection = kw.intersection(ckw)
                union = kw.union(ckw)
                
                if len(union) > 0 and (len(intersection) / len(union) >= 0.3 or len(intersection) >= 3):
                    if article['bias'] not in cluster['articles']:
                        cluster['articles'][article['bias']] = []
                    cluster['articles'][article['bias']].append(article)
                    placed = True
                    break
                    
            if not placed:
                clusters.append({
                    'topic': article['title'],
                    'core_keywords': kw,
                    'articles': {article['bias']: [article]}
                })
        
        complete_clusters = []
        partial_clusters = []
        
        for cluster in clusters:
            bias_articles = cluster['articles']
            categories_present = len(bias_articles)
            
            selected = {}
            for bias in bias_articles:
                best = min(bias_articles[bias], key=lambda x: x.get('priority', 99))
                selected[bias] = best
                
            all_kw = []
            for b, a in selected.items():
                all_kw.extend(self.extract_keywords(a['title']))
            top_kw = [k for k, v in Counter(all_kw).most_common(6)]
            topic_name = ' '.join(top_kw).title()
            if not topic_name:
                topic_name = cluster['topic']
                
            cluster_size = sum(len(a) for a in bias_articles.values())
                
            if categories_present == 5:
                complete_clusters.append({
                    'topic': topic_name,
                    'articles': selected,
                    'match_score': 1.0,
                    'keywords': tuple(top_kw),
                    'cluster_size': cluster_size
                })
            elif categories_present >= 3:
                partial_clusters.append({
                    'topic': topic_name,
                    'articles': selected,
                    'match_score': len(selected) / 5.0,
                    'keywords': tuple(top_kw),
                    'cluster_size': cluster_size
                })
                
        complete_clusters.sort(key=lambda x: x['cluster_size'], reverse=True)
        partial_clusters.sort(key=lambda x: x['cluster_size'], reverse=True)
        
        return complete_clusters[:15], partial_clusters[:10]

# --- 4. EXECUTE ---
print("Starting High Volume BiasFree Smart Scraper...")
scraper = HighVolumeScraper()
articles = scraper.fetch_all()

print(f"Fetched articles: Left: {len(articles['left'])}, Left-Center: {len(articles['left-center'])}, Center: {len(articles['center'])}, Right-Center: {len(articles['right-center'])}, Right: {len(articles['right'])}")

matcher = HighVolumeMatcher()
complete, partial = matcher.cluster_by_keywords(articles)

print(f"\nFound {len(complete)} complete 5-way matches and {len(partial)} partial matches.")

all_matches = complete + partial
output_data = []

newspaper_config = Config()
newspaper_config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
newspaper_config.request_timeout = 8

# Helper to fetch and parse article text safely
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
    "right": "farRightText"
}

# Process the top matches
for cluster in all_matches:
    print(f"\nProcessing Topic: {cluster['topic']}")
    
    final_data = {
        "id": hash(cluster['topic']) % 10000000,
        "date": datetime.today().strftime('%Y-%m-%d'),
        "topic": cluster['topic'],
        "match_score": cluster['match_score'],
        "articles": cluster['articles'],
        "farLeftText": "No article found in this category for this topic.",
        "centerLeftText": "No article found in this category for this topic.",
        "centerText": "No article found in this category for this topic.",
        "centerRightText": "No article found in this category for this topic.",
        "farRightText": "No article found in this category for this topic."
    }
    
    has_content = False
    
    # We can parallelize the newspaper fetching per topic to speed up
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_map = {}
        for bias_key, article_info in cluster['articles'].items():
            future = executor.submit(fetch_article_text, article_info['url'])
            future_map[future] = bias_key
            
        for future in as_completed(future_map):
            bias_key = future_map[future]
            text = future.result()
            if text and len(text) > 300:
                json_key = mapping[bias_key]
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


