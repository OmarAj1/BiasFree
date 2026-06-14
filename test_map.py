import csv, re
bias_map={}
with open('data/sources.csv', 'r') as file:
 for row in csv.DictReader(file):
  n=row['news_source'].lower().strip()
  n=re.sub(r'\s*\(.*?\)\s*', '', n)
  n=n.replace(' - news', '').replace(' online news', '').replace('.com', '').replace(' news', '')
  bias_map[n.strip()] = row['rating'].lower().strip()

sources=['The Jerusalem Post on MSN', 'ABC (Australian Broadcasting Corporation)', 'Yahoo', 'Reuters on MSN', 'CNN International', 'Sky News on MSN', 'LADbible on MSN', 'BBC', 'USA TODAY on MSN', 'Daily Express on MSN', 'The Sun', 'CBC.ca']
for s in sources:
 c = s.lower().strip().replace(' on msn', '').replace(' on yahoo', '').replace(' news', '')
 m = None
 if c in bias_map:
  m = bias_map[c]
 else:
  for k, v in bias_map.items():
   if k in c or c in k:
    m = v
    break
 print(f'{s} -> {c} -> {m}')
