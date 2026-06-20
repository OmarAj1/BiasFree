import React from 'react';

interface Article {
  title: string;
  url: string;
  source: string;
}

interface Story {
  id: number;
  topic: string;
  match_score: number;
  articles: {
    left?: Article;
    'left-center'?: Article;
    center?: Article;
    'right-center'?: Article;
    right?: Article;
  };
  missing_categories?: string[];
}

interface BiasSpectrumProps {
  story: Story;
  onSelectStory: () => void;
}

const cleanArticleHeadline = (title: string): string => {
  if (!title) return "";
  let cleaned = title.split(" - ")[0].split(" | ")[0].split(" – ")[0].split(" : ")[0].trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  const words = cleaned.split(/\s+/);
  if (words.length > 7) {
    return words.slice(0, 7).join(" ") + "...";
  }
  return cleaned;
};

const BiasSpectrum: React.FC<BiasSpectrumProps> = ({ story, onSelectStory }) => {
  // Using the exact keys from scraper.py
  const categories = [
    { key: 'left', label: 'Far Left', color: '#ff4444', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(96,165,250,0.9))' }, // Keeping original left=blue, right=red mapping from the App? The user asked for specific colors. I will use the user's colors but mapped to the design system (progressives usually blue in this app). Let's stick to the app's current theme: Left=Blue, Right=Red.
    { key: 'left-center', label: 'Lean Left', color: '#ff8888', gradient: 'linear-gradient(135deg, rgba(96,165,250,0.8), rgba(147,197,253,0.8))' },
    { key: 'center', label: 'Center', color: '#aaaaaa', gradient: 'linear-gradient(135deg, rgba(156,163,175,0.7), rgba(209,213,219,0.7))' },
    { key: 'right-center', label: 'Lean Right', color: '#8888ff', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(248,113,113,0.8))' },
    { key: 'right', label: 'Far Right', color: '#4444ff', gradient: 'linear-gradient(135deg, rgba(220,38,38,0.9), rgba(248,113,113,0.9))' }
  ];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 transition-all hover:shadow-md">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
        <h3 className="font-serif text-lg font-bold text-slate-800">{cleanArticleHeadline(story.topic)}</h3>
        <div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${story.match_score === 1 ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
            {story.match_score === 1 ? '🎯 Complete 5-way' : `⚠️ ${Math.round(story.match_score * 100)}% Match`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-[1px] bg-slate-200">
        {categories.map((cat, idx) => {
          const article = story.articles[cat.key as keyof typeof story.articles];
          const isMissing = !article;
          
          return (
            <div 
              key={cat.key} 
              className={`p-4 min-h-[160px] flex flex-col ${isMissing ? 'bg-slate-50 opacity-60' : 'bg-white'}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-center mb-3" style={{ color: isMissing ? '#94a3b8' : '#475569' }}>
                {cat.label}
              </div>
              
              {isMissing ? (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-400">
                  <span className="text-xl mb-1">📭</span>
                  <span className="text-[10px] font-mono">No coverage</span>
                </div>
              ) : (
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex-grow flex flex-col group no-underline hover:opacity-80 transition-opacity">
                  <div className="text-xs font-medium text-slate-800 mb-2 leading-relaxed flex-grow">
                    {cleanArticleHeadline(article.title)}
                  </div>
                  <div className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider mt-auto pt-2 border-t border-slate-100">
                    {article.source}
                  </div>
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-3">
        <button 
          onClick={onSelectStory}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2"
        >
          View Highlighted Lexicon Analysis
        </button>
      </div>
    </div>
  );
};

export default BiasSpectrum;
