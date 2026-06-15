clusters = [{'articles': {'left': [1,2], 'right': [3]}}]
print(sum(len(a) for a in clusters[0]['articles'].values()))
