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
    # LEFT
    {"name": "The Guardian (World)", "url": "https://www.theguardian.com/world/rss", "bias_category": "left", "priority": 1},
    {"name": "The Guardian (US)", "url": "https://www.theguardian.com/us-news/rss", "bias_category": "left", "priority": 1},
    {"name": "Mother Jones", "url": "https://www.motherjones.com/feed", "bias_category": "left", "priority": 2},
    {"name": "The Nation", "url": "https://www.thenation.com/feed", "bias_category": "left", "priority": 3},
    {"name": "Jacobin", "url": "https://jacobin.com/feed", "bias_category": "left", "priority": 4},
    {"name": "The Intercept", "url": "https://theintercept.com/feed/?lang=en", "bias_category": "left", "priority": 5},
    {"name": "Democracy Now", "url": "https://www.democracynow.org/democracynow.rss", "bias_category": "left", "priority": 6},
    {"name": "Slate", "url": "https://slate.com/feeds/all.rss.xml", "bias_category": "left", "priority": 7},
    {"name": "Daily Kos", "url": "https://feeds.dailykos.com", "bias_category": "left", "priority": 8},
    {"name": "AlterNet", "url": "https://www.alternet.org/feeds/feed.rss", "bias_category": "left", "priority": 9},
    {"name": "Raw Story", "url": "https://www.rawstory.com/feeds/feed.rss", "bias_category": "left", "priority": 10},

    # LEFT-CENTER
    {"name": "MSNBC", "url": "https://www.msnbc.com/feeds/latest", "bias_category": "left-center", "priority": 1},
    {"name": "CNN Top Stories", "url": "http://rss.cnn.com/rss/edition.rss", "bias_category": "left-center", "priority": 2},
    {"name": "CNN Politics", "url": "http://rss.cnn.com/rss/cnn_allpolitics.rss", "bias_category": "left-center", "priority": 2},
    {"name": "Politico", "url": "https://rss.politico.com/politics-news.xml", "bias_category": "left-center", "priority": 3},
    {"name": "HuffPost", "url": "https://www.huffpost.com/section/front-page/feed", "bias_category": "left-center", "priority": 4},
    {"name": "HuffPost Politics", "url": "https://www.huffpost.com/section/politics/feed", "bias_category": "left-center", "priority": 4},
    {"name": "Vox", "url": "https://www.vox.com/rss/index.xml", "bias_category": "left-center", "priority": 5},
    {"name": "The Atlantic", "url": "https://www.theatlantic.com/feed/all", "bias_category": "left-center", "priority": 6},
    {"name": "NYT World", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "bias_category": "left-center", "priority": 7},
    {"name": "NYT US", "url": "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", "bias_category": "left-center", "priority": 7},
    {"name": "NYT Politics", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", "bias_category": "left-center", "priority": 7},
    {"name": "CBS News", "url": "https://www.cbsnews.com/latest/rss/main", "bias_category": "left-center", "priority": 8},
    {"name": "NBC News", "url": "https://feeds.nbcnews.com/nbcnews/public/news", "bias_category": "left-center", "priority": 9},
    {"name": "ABC News", "url": "https://abcnews.go.com/abcnews/topstories", "bias_category": "left-center", "priority": 10},

    # CENTER
    {"name": "Reuters General", "url": "https://www.reutersagency.com/feed/?best-topics=political-general&type=rx", "bias_category": "center", "priority": 1},
    {"name": "BBC News Front", "url": "http://feeds.bbci.co.uk/news/rss.xml", "bias_category": "center", "priority": 2},
    {"name": "BBC News World", "url": "http://feeds.bbci.co.uk/news/world/rss.xml", "bias_category": "center", "priority": 2},
    {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml", "bias_category": "center", "priority": 3},
    {"name": "NPR Politics", "url": "https://feeds.npr.org/1014/rss.xml", "bias_category": "center", "priority": 3},
    {"name": "PBS", "url": "https://www.pbs.org/newshour/feeds/rss/headlines", "bias_category": "center", "priority": 4},
    {"name": "The Hill Top", "url": "https://thehill.com/feed", "bias_category": "center", "priority": 5},
    {"name": "The Hill Senate", "url": "https://thehill.com/homenews/senate/feed", "bias_category": "center", "priority": 5},
    {"name": "The Hill House", "url": "https://thehill.com/homenews/house/feed", "bias_category": "center", "priority": 5},
    {"name": "Newsweek", "url": "https://www.newsweek.com/rss", "bias_category": "center", "priority": 6},
    {"name": "USA Today Wash", "url": "https://www.usatoday.com/washington/rss", "bias_category": "center", "priority": 7},
    {"name": "AP Top", "url": "https://apnews.com/rss/world", "bias_category": "center", "priority": 8},

    # RIGHT-CENTER
    {"name": "The Wall Street Journal", "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "bias_category": "right-center", "priority": 1},
    {"name": "WSJ US", "url": "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml", "bias_category": "right-center", "priority": 1},
    {"name": "Fox News Latest", "url": "http://feeds.foxnews.com/foxnews/latest", "bias_category": "right-center", "priority": 2},
    {"name": "Fox News Politics", "url": "http://feeds.foxnews.com/foxnews/politics", "bias_category": "right-center", "priority": 2},
    {"name": "Fox News US", "url": "http://feeds.foxnews.com/foxnews/national", "bias_category": "right-center", "priority": 2},
    {"name": "New York Post", "url": "https://nypost.com/feed", "bias_category": "right-center", "priority": 3},
    {"name": "Washington Examiner", "url": "https://www.washingtonexaminer.com/rss", "bias_category": "right-center", "priority": 4},
    {"name": "National Review", "url": "https://www.nationalreview.com/feed", "bias_category": "right-center", "priority": 5},
    {"name": "Reason", "url": "https://reason.com/feed", "bias_category": "right-center", "priority": 6},
    {"name": "The Spectator", "url": "https://thespectator.com/feed/", "bias_category": "right-center", "priority": 7},
    {"name": "Washington Times", "url": "https://www.washingtontimes.com/rss/headlines/news/", "bias_category": "right-center", "priority": 8},
    
    # RIGHT
    {"name": "Breitbart", "url": "http://feeds.feedburner.com/breitbart", "bias_category": "right", "priority": 1},
    {"name": "Breitbart Politics", "url": "http://feeds.feedburner.com/breitbart/politics", "bias_category": "right", "priority": 1},
    {"name": "The Federalist", "url": "https://thefederalist.com/feed", "bias_category": "right", "priority": 2},
    {"name": "Daily Wire", "url": "https://www.dailywire.com/feed", "bias_category": "right", "priority": 3},
    {"name": "Zero Hedge", "url": "http://feeds.feedburner.com/zerohedge", "bias_category": "right", "priority": 4},
    {"name": "Newsmax", "url": "https://www.newsmax.com/rss/Politics/1/", "bias_category": "right", "priority": 5},
    {"name": "Townhall", "url": "https://townhall.com/api/feed/columnists", "bias_category": "right", "priority": 6},
    {"name": "Daily Caller", "url": "https://feeds.dailycaller.com/dailycaller", "bias_category": "right", "priority": 7},
    {"name": "PJ Media", "url": "https://pjmedia.com/feed", "bias_category": "right", "priority": 8},
    {"name": "RedState", "url": "https://redstate.com/feed", "bias_category": "right", "priority": 9},
]

class HighVolumeScraper:
    def fetch_feed(self, source):
        """Fetch single RSS feed"""
        try:
            feed = feedparser.parse(source['url'])
            articles = []
            for entry in feed.entries[:5000]:  # Up to 5000 per source
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
                
                if len(union) > 0 and (len(intersection) / len(union) >= 0.15 or len(intersection) >= 2):
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
            elif categories_present >= 2:
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

if not all_matches:
    print("\nNo overlapping topics found. Falling back to top headlines per category.")
    fallback_articles = {}
    for bias, article_list in articles.items():
        if article_list:
            fallback_articles[bias] = article_list[0]
            
    if fallback_articles:
        all_matches.append({
            'topic': 'Latest Global Headlines',
            'articles': {bias: {"url": a['url'], "title": a['title'], "source": a['source'], "priority": a['priority']} for bias, a in fallback_articles.items()},
            'match_score': len(fallback_articles) / 5.0
        })

output_data = []

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
    "right": "farRightText"
}

def get_omissions(center_text, partisan_text):
    if not center_text or not partisan_text: return 50
    # Naive entity matching
    center_words = set(re.findall(r'\b[A-Z][a-z]+\b', center_text))
    partisan_words = set(re.findall(r'\b[A-Z][a-z]+\b', partisan_text))
    if not center_words: return 0
    missing = center_words - partisan_words
    risk = (len(missing) / len(center_words)) * 100
    return min(100, int(risk))

# Process the top matches
for cluster in all_matches:
    print(f"\nProcessing Topic: {cluster['topic']}")
    
    final_data = {
        "id": hash(cluster['topic']) % 10000000,
        "date": datetime.today().strftime('%Y-%m-%d'),
        "topic": cluster['topic'],
        "match_score": cluster['match_score'],
        "cluster_size": cluster.get('cluster_size', 1),
        "articles": cluster['articles'],
        "farLeftText": "No article found in this category for this topic.",
        "centerLeftText": "No article found in this category for this topic.",
        "centerText": "No article found in this category for this topic.",
        "centerRightText": "No article found in this category for this topic.",
        "farRightText": "No article found in this category for this topic.",
        "omissions": {}
    }
    
    has_content = False
    
    # Process articles sequentially
    fetched_texts = {}
    for bias_key, article_info in cluster['articles'].items():
        text = fetch_article_text(article_info['url'])
        if text and len(text) > 300:
            json_key = mapping[bias_key]
            final_data[json_key] = highlight_bias(text, bias_key)
            fetched_texts[bias_key] = text
            has_content = True
            
    # Calculate omissions
    center_text = fetched_texts.get('center', '')
    for bias_key in cluster['articles'].keys():
        if bias_key != 'center':
           final_data['omissions'][bias_key] = get_omissions(center_text, fetched_texts.get(bias_key, ''))
            
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
            
    # Overwrite old topics if newer ones have a better match score or size
    history_dict = {}
    for item in history:
        sig = f"{item.get('date', '')}-{item.get('topic', '')}"
        history_dict[sig] = item
        
    for item in output_data:
        sig = f"{item.get('date', '')}-{item.get('topic', '')}"
        if sig in history_dict:
            old_item = history_dict[sig]
            if item.get('match_score', 0) > old_item.get('match_score', 0) or \
               (item.get('match_score', 0) == old_item.get('match_score', 0) and item.get('cluster_size', 0) > old_item.get('cluster_size', 0)):
                history_dict[sig] = item
        else:
            history_dict[sig] = item
            
    history = list(history_dict.values())
    
    # Sort history daily by match_score and size to keep best on top
    history.sort(key=lambda x: (x.get('date', ''), x.get('match_score', 0), x.get('cluster_size', 0)), reverse=True)
    
    # Deduplicate and limit topics strictly to best 15 per day
    daily_counts = {}
    limited_history = []
    for item in history:
        d = item.get('date', '')
        if daily_counts.get(d, 0) < 15:
            limited_history.append(item)
            daily_counts[d] = daily_counts.get(d, 0) + 1
            
    history = limited_history

    
    cutoff_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    history = [item for item in history if item.get("date", "") >= cutoff_date]
    
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
    
    # Also write straight to daily-slider.json for immediate use
    with open("data/daily-slider.json", "w", encoding="utf-8") as file:
        json.dump(output_data, file, indent=2)

    print(f"\n--- Scraped, Aggregated, and Highlighted {len(output_data)} Topics Complete ---")
    print("Results saved to data/daily-slider.json")
else:
    print("\n--- Failed to scrape complete cross-partisan data for any topic. ---")
