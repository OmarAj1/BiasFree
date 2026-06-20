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
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'it', 'that', 'this', 'as', 'from', 'be', 'have', 'has', 'had', 'not',
            'about', 'above', 'after', 'again', 'against', 'all', 'am', 'any', 'arent', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt',
            'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'further', 'hadnt', 'hasnt', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself',
            'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'into', 'isnt', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'off', 'once',
            'only', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'thats', 'their',
            'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'those', 'through', 'too', 'under', 'until', 'up', 'very', 'wasnt', 'we', 'wed',
            'well', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve',
            'your', 'yours', 'yourself', 'yourselves', 'says', 'said', 'will', 'also', 'new', 'news', 'first', 'two', 'three', 'years', 'year', 'week', 'weeks', 'day', 'days', 'time', 'calls', 'called',
            'proposes', 'proposed', 'every', 'everyone', 'another', 'many', 'much', 'some', 'any', 'might', 'may', 'must', 'should', 'could', 'would', 'done', 'get', 'got', 'make', 'makes', 'made', 'us',
            'nearly', 'about', 'over', 'than', 'under', 'more', 'less', 'most', 'least', 'up', 'down', 'high', 'low', 'rise', 'rises', 'fall', 'falls', 'toll', 'cases', 'week', 'dead', 'bill', 'due', 'during'
        }
        self.generic_words = {
            'trump', 'biden', 'obama', 'clinton', 'harris', 'desantis', 'kennedy', 'politician', 'president', 'vice', 'governor', 'house', 'senate', 'congress', 'supreme', 'court', 'judge', 'justice', 'white', 'administration', 'gop', 'democrats', 'democrat', 'republicans', 'republican', 'election', 'voters', 'campaign', 'debate', 'poll', 'polls', 'rally', 'rallies', 'state', 'bill', 'law', 'legal', 'lawsuit', 'federal', 'official', 'officials', 'government', 'news', 'report', 'claims', 'warns', 'announces', 'accuses', 'investigation', 'probe', 'ruling', 'case', 'trial', 'jury', 'verdict', 'charged', 'charges'
        }
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
                
                if len(union) > 0:
                    jaccard = len(intersection) / len(union)
                    specific_intersection = intersection - self.generic_words
                    
                    is_match = False
                    if jaccard >= 0.50:
                        is_match = True
                    elif jaccard >= 0.35 and len(specific_intersection) >= 2:
                        is_match = True
                    elif len(specific_intersection) >= 3 and len(intersection) >= 4:
                        is_match = True
                        
                    if is_match:
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
            
            selected = {}
            for bias in bias_articles:
                best = min(bias_articles[bias], key=lambda x: x.get('priority', 99))
                selected[bias] = best
                
            # --- Strict Topic Adherence Check ---
            # 1. Aggregate keywords from the initially selected articles
            all_kw = []
            for b, a in selected.items():
                all_kw.extend(self.extract_keywords(a['title']))
                
            # 2. Identify the true core words of this cluster (words appearing in multiple sources)
            kw_counts = Counter(all_kw)
            core_words = {k for k, v in kw_counts.items() if v >= 2}
            if len(core_words) < 2:
                core_words = {k for k, v in kw_counts.most_common(4)}
                
            # 3. Re-evaluate each selected article to ensure it actually matches the established core
            strictly_selected = {}
            for bias, a in selected.items():
                akw = set(self.extract_keywords(a['title']))
                intersection = akw.intersection(core_words)
                specific = intersection - self.generic_words
                
                union = akw.union(core_words)
                jaccard = len(intersection) / len(union) if union else 0
                
                # Strict criteria: must share specific keywords, or have a significant overlap
                is_valid = False
                if len(specific) >= 2:
                    is_valid = True
                elif len(intersection) >= 3:
                    is_valid = True
                elif jaccard >= 0.25 and len(intersection) >= 1:
                    is_valid = True
                    
                if is_valid:
                    strictly_selected[bias] = a
                    
            selected = strictly_selected
            categories_present = len(selected)
            
            # If after removing outliers we no longer have a comparison (needs at least 2), discard cluster
            if categories_present < 2:
                continue
            # ------------------------------------
                
            all_kw_final = []
            for b, a in selected.items():
                all_kw_final.extend(self.extract_keywords(a['title']))
            top_kw = [k for k, v in Counter(all_kw_final).most_common(6)]
            topic_name = ' '.join(top_kw).title()
            if not topic_name:
                topic_name = cluster['topic']
                
            # Only count the size of the articles that actually belong to the validated biases
            cluster_size = sum(len(bias_articles[b]) for b in selected.keys() if b in bias_articles)
                
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
                    'match_score': categories_present / 5.0,
                    'keywords': tuple(top_kw),
                    'cluster_size': cluster_size
                })
                
        complete_clusters.sort(key=lambda x: x['cluster_size'], reverse=True)
        partial_clusters.sort(key=lambda x: x['cluster_size'], reverse=True)
        
        return complete_clusters[:25], partial_clusters[:20]

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
    print("\nNo overlapping topics found. Falling back to top headlines per category as separate stories.")
    for bias, article_list in articles.items():
        if article_list:
            a = article_list[0]
            all_matches.append({
                'topic': a['title'],
                'articles': {bias: {"url": a['url'], "title": a['title'], "source": a['source'], "priority": a['priority']}},
                'match_score': 0.2,
                'cluster_size': 1
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
            
    # Overwrite old topics if newer ones represent the same story and have better or equal score/size, preventing messy duplications across hourly runs
    def is_same_story(item1, item2):
        if item1.get('date') != item2.get('date'):
            return False
            
        urls1 = set(art.get('url') for art in item1.get('articles', {}).values() if isinstance(art, dict) and art.get('url'))
        urls2 = set(art.get('url') for art in item2.get('articles', {}).values() if isinstance(art, dict) and art.get('url'))
        if urls1.intersection(urls2):
            return True
            
        t1 = set(re.sub(r'[^\w\s]', '', item1.get('topic', '').lower()).split())
        t2 = set(re.sub(r'[^\w\s]', '', item2.get('topic', '').lower()).split())
        t1_clean = {w for w in t1 if w not in matcher.stop_words and len(w) > 3}
        t2_clean = {w for w in t2 if w not in matcher.stop_words and len(w) > 3}
        
        if t1_clean and t2_clean:
            intersection = t1_clean.intersection(t2_clean)
            union = t1_clean.union(t2_clean)
            jaccard = len(intersection) / len(union)
            if jaccard >= 0.55 or (jaccard >= 0.40 and len(intersection) >= 3) or len(intersection) >= 4:
                return True
        return False

    new_history = list(history)
    for new_item in output_data:
        matched_idx = -1
        for idx, old_item in enumerate(new_history):
            if is_same_story(new_item, old_item):
                matched_idx = idx
                break
                
        if matched_idx >= 0:
            old_item = new_history[matched_idx]
            if new_item.get('match_score', 0) >= old_item.get('match_score', 0):
                new_history[matched_idx] = new_item
        else:
            new_history.append(new_item)
            
    history = new_history
    
    # Sort history daily by match_score and size to keep best on top
    history.sort(key=lambda x: (x.get('date', ''), x.get('match_score', 0), x.get('cluster_size', 0)), reverse=True)
    
    # Deduplicate and limit topics strictly to best 15 per day, allow more if 4+ matching
    daily_counts = {}
    limited_history = []
    for item in history:
        d = item.get('date', '')
        score = item.get('match_score', 0)
        # Allow if we haven't reached 15, or if score is >= 0.8 (4 out of 5 matched biases)
        if daily_counts.get(d, 0) < 15 or score >= 0.8:
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
