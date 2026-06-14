import urllib.parse, urllib.request, re, csv

query = urllib.parse.quote('Missouri plane crash')
search_rss = f'https://www.bing.com/news/search?q={query}&format=rss'
req = urllib.request.Request(search_rss, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
 xml_data = response.read().decode('utf-8')

items = re.findall(r'<item>([\s\S]*?)</item>', xml_data, re.IGNORECASE)
print([re.search(r'<News:Source>(.*?)</News:Source>', i, re.IGNORECASE).group(1) for i in items if re.search(r'<News:Source>(.*?)</News:Source>', i, re.IGNORECASE)])
