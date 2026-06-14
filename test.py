import feedparser
feed = feedparser.parse("https://www.bing.com/news/search?q=test&format=rss")
print(feed.entries[0].source)
