import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  AlertTriangle, 
  BookOpen, 
  SlidersHorizontal,
  Clock,
  Calendar,
  Share2,
  Twitter,
  Linkedin,
  ArrowLeft,
  Sparkles,
  Activity,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { BIAS_EDUCATIONAL_TIPS, PRE_PACKAGED_STORIES } from "./data";
import BiasSpectrum from "./components/BiasSpectrum";
import { LineChart, Line, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/**
 * Extracts words wrapped in bias highlight tags
 */
const extractLoadedWords = (html: string): string[] => {
  if (!html) return [];
  const regex = /<span[^>]*class=["'][^"']*highlight-bias[^"']*["'][^>]*>([^<]+)<\/span>/gi;
  const words: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
      words.push(match[1]);
  }
  return [...new Set(words)]; // Unique words
};

/**
 * Calculates raw volatility (count of unique loaded words across perspectives)
 */
const getStoryVolatility = (story: any): number => {
  if (!story) return 0;
  const allBiased = [
    ...extractLoadedWords(story.farLeftText || ""),
    ...extractLoadedWords(story.centerLeftText || ""),
    ...extractLoadedWords(story.centerRightText || ""),
    ...extractLoadedWords(story.farRightText || "")
  ];
  return new Set(allBiased).size;
};

/**
 * Formats NLP search terms to a reader-friendly topic outline, utilizing high-integrity center source titles when available
 */
const cleanHeadline = (topic: string, centerTitle?: string): string => {
  let raw = centerTitle || topic || "";
  if (!raw) return "Global News Story";
  
  // Clean off standard corporate press suffixes (" - Reuters", "| CNN", etc.)
  let cleaned = raw.split(" - ")[0].split(" | ")[0].split(" – ")[0].split(" : ")[0].trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  if (cleaned.length < 5 && topic) {
    cleaned = topic.split(" - ")[0].split(" | ")[0].split(" – ")[0].trim();
  }
  
  const words = cleaned.split(/\s+/);
  if (words.length > 7) {
    return words.slice(0, 7).join(" ") + "...";
  }
  return cleaned;
};

export default function App() {
  const [dailyDataList, setDailyDataList] = useState<any[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [biasValue, setBiasValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSideBySide, setIsSideBySide] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'directory' | 'lexicon'>('directory');
  const [activeTab, setActiveTab] = useState<'complete' | 'partial'>('complete');

  const [synonyms, setSynonyms] = useState<Record<string, string>>({});
  const [hoveredWord, setHoveredWord] = useState<{word: string, x: number, y: number} | null>(null);
  const [showTldr, setShowTldr] = useState(false);
  const [tldrText, setTldrText] = useState("");
  const [tldrLoading, setTldrLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const urls = [
        `/data/daily-slider-history.json?t=${new Date().getTime()}`,
        '/daily-slider-history.json',
        `https://raw.githubusercontent.com/OmarAj1/BiasFree/main/data/daily-slider-history.json?t=${new Date().getTime()}`,
        `/data/daily-slider.json?t=${new Date().getTime()}`
      ];

      const cleanStory = (story: any) => {
        const centerTitle = story.articles?.center?.title || "";
        return {
          ...story,
          topic: cleanHeadline(story.topic, centerTitle)
        };
      };

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          
          let text = await res.text();
          if (!text || text.trim() === "404: Not Found" || text.trim().toLowerCase().startsWith("<!doctype html>")) continue;
          
          let data;
          try {
            data = JSON.parse(text);
          } catch (initialError) {
            console.warn(`Initial JSON parse failed for ${url}, attempting to extract JSON...`);
            const firstBrace = text.indexOf('{');
            const firstBracket = text.indexOf('[');
            const startIndex = (firstBrace !== -1 && firstBracket !== -1) 
              ? Math.min(firstBrace, firstBracket) 
              : Math.max(firstBrace, firstBracket);
              
            const lastBrace = text.lastIndexOf('}');
            const lastBracket = text.lastIndexOf(']');
            const endIndex = Math.max(lastBrace, lastBracket);
            
            if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
              try {
                const cleanedText = text.substring(startIndex, endIndex + 1);
                data = JSON.parse(cleanedText);
              } catch (secondError) {
                console.warn(`Failed to parse extracted JSON from ${url}`);
                continue;
              }
            } else {
              console.warn(`No valid JSON structure found in response from ${url}`);
              continue;
            }
          }

          if (Array.isArray(data)) {
            const processed = data.map(cleanStory);
            const reversed = processed.reverse();
            setDailyDataList(reversed);
            if (reversed.length > 0) {
              setSelectedDate(reversed[0].date);
            }
          }
          else if (data) {
            const processed = cleanStory(data);
            setDailyDataList([processed]);
            setSelectedDate(processed.date);
          }
          
          setIsLoading(false);
          return; // Success, stop trying other URLs
        } catch (err) {
          console.warn(`Failed to process data from ${url}:`, err);
        }
      }
      
      // Fallback if all external JSON endpoints fail to load
      console.warn("All external/scraped data sources were missing or failed to load. Falling back to high-integrity pre-packaged database.");
      
      const newSynonyms: Record<string, string> = {};
      const fallbackList = PRE_PACKAGED_STORIES.map((story, index) => {
        const hashString = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash) % 10000000;
        };

        const highlightWords = (text: string, adjectivesArr: any[]) => {
          let highlighted = text;
          adjectivesArr.forEach((adj) => {
            const phraseEscaped = adj.phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\b${phraseEscaped}\\b`, 'gi');
            highlighted = highlighted.replace(regex, (match: string) => {
              return `<span class="highlight-bias">${match}</span>`;
            });
          });
          return highlighted;
        };

        const leftAdjectives = story.leftFraming?.adjectives || [];
        const rightAdjectives = story.rightFraming?.adjectives || [];

        const farLeftText = highlightWords(story.leftFraming?.storyText || "", leftAdjectives);
        const centerLeftText = farLeftText;
        const centerRightText = highlightWords(story.rightFraming?.storyText || "", rightAdjectives);
        const farRightText = centerRightText;
        const centerText = Array.isArray(story.neutralSummary) ? story.neutralSummary.join("\n\n") : (story.neutralSummary || "");

        leftAdjectives.forEach(adj => {
          newSynonyms[adj.phrase] = adj.alternative;
        });
        rightAdjectives.forEach(adj => {
          newSynonyms[adj.phrase] = adj.alternative;
        });

        const leftUrl = "https://example.com/left";
        const centerUrl = "https://example.com/center";
        const rightUrl = "https://example.com/right";

        return {
          id: hashString(String(story.id || index)),
          date: story.date || "2026-06-14",
          topic: cleanHeadline(story.title || "", story.title || ""),
          match_score: 1.0,
          cluster_size: 5,
          articles: {
            left: { title: story.leftFraming?.headline || story.title || "", url: leftUrl, source: story.leftFraming?.outletName || "Left Feed" },
            'left-center': { title: story.leftFraming?.headline || story.title || "", url: leftUrl, source: story.leftFraming?.outletName || "Left-Center Feed" },
            center: { title: story.title || "", url: centerUrl, source: "Neutral Baseline" },
            'right-center': { title: story.rightFraming?.headline || story.title || "", url: rightUrl, source: story.rightFraming?.outletName || "Right-Center Feed" },
            right: { title: story.rightFraming?.headline || story.title || "", url: rightUrl, source: story.rightFraming?.outletName || "Right Feed" }
          },
          farLeftText,
          centerLeftText,
          centerText,
          centerRightText,
          farRightText,
          omissions: {
            left: 20,
            'left-center': 10,
            'right-center': 15,
            right: 25
          }
        };
      });

      setDailyDataList(fallbackList);
      setSynonyms(prev => ({ ...prev, ...newSynonyms }));
      if (fallbackList.length > 0) {
        setSelectedDate(fallbackList[0].date);
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const uniqueDates = useMemo(() => {
    return [...new Set(dailyDataList.map(item => item.date))];
  }, [dailyDataList]);

  const filteredStories = useMemo(() => {
    if (!selectedDate) return [];
    return dailyDataList.filter(item => item.date === selectedDate);
  }, [dailyDataList, selectedDate]);

  useEffect(() => {
    setActiveStoryIndex(0);
  }, [selectedDate]);

  const dailyData = filteredStories[activeStoryIndex] || null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const getBiasLabelAndColor = (val: number) => {
    if (val <= -60) return { key: 'left', label: "Far-Left Slant", color: "text-blue-600 bg-blue-50 border-blue-200", border: "border-blue-500", highlightHover: "hover:bg-blue-100", theme: "left-heavy", outlet: "Progressive Feed" };
    if (val < -10) return { key: 'left-center', label: "Center-Left Lean", color: "text-indigo-500 bg-indigo-50 border-indigo-150", border: "border-indigo-400", highlightHover: "hover:bg-indigo-100", theme: "left-leaning", outlet: "Progressive Feed" };
    if (val >= 10 && val < 60) return { key: 'right-center', label: "Center-Right Lean", color: "text-amber-600 bg-amber-50 border-amber-150", border: "border-amber-400", highlightHover: "hover:bg-amber-100", theme: "right-leaning", outlet: "Conservative Feed" };
    if (val >= 60) return { key: 'right', label: "Far-Right Slant", color: "text-red-600 bg-red-50 border-red-200", border: "border-red-500", highlightHover: "hover:bg-red-100", theme: "right-heavy", outlet: "Conservative Feed" };
    return { key: 'center', label: "Strictly Objective Facts", color: "text-slate-700 bg-slate-100 border-slate-300", border: "border-slate-500", highlightHover: "hover:bg-gray-200", theme: "neutral", outlet: "Neutral Baseline" };
  };

  const biasState = getBiasLabelAndColor(biasValue);

  const getCurrentHtml = () => {
    if (!dailyData) return "";
    if (biasValue <= -60) return dailyData.farLeftText;
    if (biasValue < -10) return dailyData.centerLeftText;
    if (biasValue >= 10 && biasValue < 60) return dailyData.centerRightText;
    if (biasValue >= 60) return dailyData.farRightText;
    return dailyData.centerText;
  };

  const currentOmissionRisk = () => {
      if (!dailyData || !dailyData.omissions) return 0;
      return dailyData.omissions[biasState.key] || 0;
  };

  const trendIndicator = useMemo(() => {
    if (!selectedDate || uniqueDates.length === 0) return null;
    
    // Sort unique dates chronologically
    const sortedDates = [...uniqueDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const currentIndex = sortedDates.indexOf(selectedDate);
    if (currentIndex <= 0) return null; // No previous day
    
    const prevDate = sortedDates[currentIndex - 1];
    const prevStories = dailyDataList.filter(item => item.date === prevDate);
    const prevVol = prevStories.reduce((sum, s) => sum + getStoryVolatility(s), 0) / (prevStories.length || 1);
    
    const currentStories = dailyDataList.filter(item => item.date === selectedDate);
    const currentVol = currentStories.reduce((sum, s) => sum + getStoryVolatility(s), 0) / (currentStories.length || 1);
    
    const difference = currentVol - prevVol;
    return {
      direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
      diff: Math.abs(difference),
      percentChange: prevVol > 0 ? Math.round((Math.abs(difference) / prevVol) * 100) : 0
    };
  }, [dailyDataList, selectedDate, uniqueDates]);

  const currentViewpointHeadline = useMemo(() => {
    if (!dailyData || !dailyData.articles) return "";
    const k = biasState.key;
    const matched = dailyData.articles[k];
    const headlineText = (matched && matched.title) ? matched.title : dailyData.topic;
    return cleanHeadline(headlineText);
  }, [dailyData, biasState.key]);

  const calculateReadingTime = (text: string) => {
    if (!text) return 0;
    const rawText = text.replace(/<[^>]*>?/gm, ''); // strip HTML tags
    const words = rawText.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  };

  const allBiasedWords = dailyData ? [
    ...extractLoadedWords(dailyData.farLeftText),
    ...extractLoadedWords(dailyData.centerLeftText),
    ...extractLoadedWords(dailyData.centerRightText),
    ...extractLoadedWords(dailyData.farRightText)
  ] : [];
  const totalUniqueBiasedWords = new Set(allBiasedWords).size;
  
  const currentWords = dailyData ? extractLoadedWords(getCurrentHtml()) : [];

  useEffect(() => {
    if (currentWords.length > 0) {
      const missing = currentWords.filter(w => !synonyms[w]);
      if (missing.length > 0) {
        fetch('/api/neutralize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words: missing })
        }).then(res => res.json()).then(data => {
          if (data.synonyms) setSynonyms(prev => ({ ...prev, ...data.synonyms }));
        }).catch(err => console.error("Error fetching synonyms:", err));
      }
    }
  }, [currentWords, synonyms]);

  useEffect(() => {
    setShowTldr(false);
    setTldrText("");
  }, [biasValue, activeStoryIndex, selectedDate]);

  const generateTldr = async () => {
    if (showTldr) {
        setShowTldr(false);
        return;
    }
    setShowTldr(true);
    setTldrLoading(true);
    try {
        const textToSummarize = getCurrentHtml().replace(/<[^>]*>?/gm, ' ');
        const res = await fetch('/api/tldr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToSummarize })
        });
        const data = await res.json();
        setTldrText(data.summary || "Summary not available");
    } catch {
        setTldrText("Failed to load TL;DR");
    } finally {
        setTldrLoading(false);
    }
  };

  const handleTextInteraction = (e: any) => {
    if (e.target && e.target.classList && e.target.classList.contains('highlight-bias')) {
       const rect = e.target.getBoundingClientRect();
       setHoveredWord({
           word: e.target.textContent,
           x: rect.left + rect.width / 2,
           y: rect.top - 10
       });
    } else {
       setHoveredWord(null);
    }
  };

  const completeStories = filteredStories.filter(s => s.match_score >= 1) || [];
  const partialStories = filteredStories.filter(s => s.match_score < 1) || [];

  // 100% Authentic, High-Integrity Volatility Trend mapping
  const trendData = useMemo(() => {
    if (uniqueDates.length === 0) return [];
    
    // Sort unique dates chronologically
    const sortedDates = [...uniqueDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Find index of selectedDate
    const currentIndex = sortedDates.indexOf(selectedDate);
    if (currentIndex === -1) return [];

    // Take the last 7 dates preceding and including the current selectedDate
    const startIndex = Math.max(0, currentIndex - 6);
    const targetDates = sortedDates.slice(startIndex, currentIndex + 1);

    return targetDates.map(dateStr => {
      const storiesForDate = dailyDataList.filter(item => item.date === dateStr);
      const avgVolatility = storiesForDate.reduce((sum, story) => sum + getStoryVolatility(story), 0) / (storiesForDate.length || 1);
      
      return {
        name: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
        volatility: Math.round(avgVolatility)
      };
    });
  }, [dailyDataList, selectedDate, uniqueDates]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col p-4 md:p-6 lg:p-8 font-sans items-center relative">
      <div className="max-w-7xl w-full flex flex-col flex-grow">
      <style>{`
        .highlight-bias {
          background-color: var(--highlight-bg, rgb(254 226 226));
          color: var(--highlight-text, rgb(153 27 27));
          border-bottom: 2px solid var(--highlight-border, rgb(239 68 68));
          padding: 0 4px;
          border-radius: 4px;
          font-weight: bold;
          transition: all 0.2s;
        }
        .highlight-bias-left {
          --highlight-bg: rgb(239 246 255);
          --highlight-text: rgb(30 58 138);
          --highlight-border: rgb(59 130 246);
        }
        .highlight-bias-right {
          --highlight-bg: rgb(254 226 226);
          --highlight-text: rgb(127 29 29);
          --highlight-border: rgb(239 68 68);
        }
      `}</style>
      
      {/* Header Section */}
      <header className="w-full border-b border-slate-200 pb-5 mb-8 flex flex-col gap-4">
        {/* Upper metadata row */}
        <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-slate-400">
          <div>// OFFLINE MEDIA WATCHDOG</div>
          <div className="flex items-center gap-1.5 font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
            LOCAL DATA MODE (ZERO COST)
          </div>
        </div>
        
        {/* Main logo / brand row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-slate-900 flex items-center gap-2">
              BIAS<span className="font-extralight text-slate-500">FREE</span>
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-2 max-w-xl leading-relaxed">
              Analyzing partisan loaded-language modifiers, omissions, and framing models through full five-way media alignments. Powered entirely offline.
            </p>
          </div>
          
          {/* Calendar Picker and coverage summary */}
          {uniqueDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 border-r pr-3 border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-400 font-sans" />
                  <span className="uppercase text-[10px] tracking-wider font-mono text-slate-400">Analysis Day:</span>
                  <select
                    value={selectedDate || ''}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-slate-400 rounded px-1"
                    aria-label="Select Date"
                  >
                    {uniqueDates.map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pl-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Archive Coverage:</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold border border-slate-200/50">
                    🎯 {completeStories.length} 5-way
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200/50">
                    ⚠️ {partialStories.length} partial
                  </span>
                </div>
            </div>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-spin w-8 h-8 rounded-full border-4 border-slate-800 border-t-transparent"></div>
        </div>
      ) : !dailyData ? (
        <div className="flex-grow flex items-center justify-center text-slate-500 font-mono text-sm bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
          No daily data found. Wait for the ghost worker to scrape.
        </div>
      ) : activeView === 'directory' ? (
        <div className="flex flex-col flex-grow">
          {/* Tabs for Directory View */}
          <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <button 
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${activeTab === 'complete' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
              onClick={() => setActiveTab('complete')}
            >
              Complete 5-Way Matches ({completeStories.length})
            </button>
            <button 
              className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${activeTab === 'partial' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
              onClick={() => setActiveTab('partial')}
            >
              Partial Matches ({partialStories.length})
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {activeTab === 'complete' && (
              completeStories.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">No complete 5-way matches today 😢</h3>
                  <p className="text-slate-500">Check back tomorrow when more topics have coverage from all perspectives!</p>
                </div>
              ) : (
                completeStories.map((story) => (
                  <BiasSpectrum 
                    key={story.id} 
                    story={story} 
                    onSelectStory={() => {
                      const idx = filteredStories.findIndex(s => s.id === story.id);
                      setActiveStoryIndex(idx);
                      setActiveView('lexicon');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} 
                  />
                ))
              )
            )}

            {activeTab === 'partial' && (
              partialStories.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">No partial matches today</h3>
                  <p className="text-slate-500">Every topic has complete coverage? That's rare!</p>
                </div>
              ) : (
                partialStories.map((story) => (
                  <BiasSpectrum 
                    key={story.id} 
                    story={story} 
                    onSelectStory={() => {
                      const idx = filteredStories.findIndex(s => s.id === story.id);
                      setActiveStoryIndex(idx);
                      setActiveView('lexicon');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} 
                  />
                ))
              )
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow items-stretch">
          
          <div className="col-span-1 md:col-span-12 mb-2 flex justify-between items-center">
            <button 
              onClick={() => setActiveView('directory')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back to News Directory
            </button>
          </div>

          {/* Core Headline Card */}
          <div id="core-headline-card" className="col-span-1 md:col-span-8 bg-white rounded-3xl p-6 border-b-4 border-slate-300 shadow-sm flex flex-col justify-between min-h-[180px]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-slate-900 text-white text-[9px] font-mono font-bold tracking-wider rounded uppercase">
                  DAILY SCAN
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[9px] font-mono items-center flex font-bold rounded uppercase border border-slate-200">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  {calculateReadingTime(getCurrentHtml())} MIN READ
                </span>
                {trendIndicator && (
                  <span className={`px-2.5 py-1 text-[9px] font-mono items-center flex font-bold rounded uppercase border ${
                    trendIndicator.direction === 'up' 
                      ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm' 
                      : trendIndicator.direction === 'down'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 shadow-sm'
                  }`}>
                    {trendIndicator.direction === 'up' ? (
                      <TrendingUp className="w-3.5 h-3.5 mr-1 text-rose-600 animate-bounce" />
                    ) : trendIndicator.direction === 'down' ? (
                      <TrendingDown className="w-3.5 h-3.5 mr-1 text-emerald-600 animate-bounce" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    )}
                    VOLATILITY: {trendIndicator.direction === 'up' ? "UP" : trendIndicator.direction === 'down' ? "DOWN" : "STABLE"} ({trendIndicator.percentChange}% vs yesterday)
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-slate-900 leading-tight">
                {dailyData.topic || "Current Top Story"}
              </h2>
              
              {/* Daily stories picker (if multiple) */}
              {filteredStories.length > 1 && (
                <div role="group" aria-label="News Topics Selector" className="flex bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 mt-5 overflow-x-auto gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 py-1.5 px-2 font-mono">// Top Topics:</span>
                  {filteredStories.map((story, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveStoryIndex(i)}
                      aria-current={i === activeStoryIndex ? "true" : "false"}
                      className={`whitespace-nowrap px-3 py-1 text-xs font-bold rounded-md transition-colors ${i === activeStoryIndex ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {story.topic || `Topic ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <p className="text-slate-400 text-[10px] uppercase font-mono mt-4 pt-4 border-t border-slate-100">
              Automated offline bias analysis. Scraped on: {dailyData.date}.
            </p>
          </div>

          {/* Stats Card */}
          <div id="stats-card" className="col-span-1 md:col-span-4 bg-orange-500 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-sm min-h-[180px]">
            <div className="relative z-10 space-y-4">
              <h3 className="text-xs font-bold uppercase opacity-80 tracking-widest font-mono">
                Detected Bias Modifiers
              </h3>
              <div>
                <div className="text-5xl font-black mb-1">
                  {totalUniqueBiasedWords}
                </div>
                <p className="text-xs opacity-90 leading-relaxed italic font-light pt-2 border-t border-white/20">
                  Total "loaded words" found across the 5 partisan variants of this story using offline lexical matching.
                </p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
          </div>

          {/* The Slider Component */}
          <div id="lens-slider-row" className="col-span-1 md:col-span-12 bg-white rounded-3xl p-6 flex flex-col justify-center border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={() => setBiasValue(-75)}
                aria-label="Set to Progressive Lens"
                className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue < -10 ? "text-blue-600 bg-blue-50 border border-blue-100" : "text-slate-400 hover:text-slate-600"}`}
              >
                Progressive Lens
              </button>
              <button 
                onClick={() => setBiasValue(0)}
                aria-label="Set to Neutral Core"
                className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue >= -10 && biasValue <= 10 ? "text-slate-800 bg-slate-100 border border-slate-200 shadow-inner" : "text-slate-400 hover:text-slate-605"}`}
              >
                Neutral Core
              </button>
              <button 
                onClick={() => setBiasValue(75)}
                aria-label="Set to Conservative Lens"
                className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue > 10 ? "text-red-600 bg-red-50 border border-red-100" : "text-slate-400 hover:text-slate-600"}`}
              >
                Conservative Lens
              </button>
            </div>
            <div className="relative h-12 flex items-center px-2">
              <div className="absolute w-full h-2 bg-slate-200 rounded-full"></div>
              <div className="absolute left-1/2 w-1.5 h-6 bg-slate-400 -translate-x-1/2 rounded"></div>
              
              <input
                type="range"
                id="bias-slider"
                aria-label="Adjust Political Bias Lens"
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={biasValue}
                title="Bias Slider"
                min="-100"
                max="100"
                step="1"
                value={biasValue}
                onChange={(e) => setBiasValue(parseInt(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') setBiasValue(Math.min(100, biasValue + 10));
                  if (e.key === 'ArrowLeft') setBiasValue(Math.max(-100, biasValue - 10));
                }}
                className="w-full h-2 bg-transparent cursor-pointer appearance-none z-10 relative outline-none focus:ring-4 focus:ring-slate-300 rounded"
                style={{
                  accentColor: biasValue === 0 ? "#475569" : biasValue < 0 ? "#2563eb" : "#dc2626"
                }}
              />
            </div>
            <div className="flex flex-col gap-3 mt-3" aria-hidden="true">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Far-Left (-100)</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">Current Overlay:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${biasState.color}`}>
                    {biasState.label}
                  </span>
                </div>
                <span>Far-Right (+100)</span>
              </div>
              <div className="flex justify-center items-center gap-3 text-[10px] uppercase font-mono tracking-wider">
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-500">Omission Risk:</span>
                      <div className="w-24 h-2 bg-white rounded-full overflow-hidden border border-slate-200 relative">
                          <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${currentOmissionRisk()}%` }} />
                      </div>
                      <span className="font-bold text-orange-600">{currentOmissionRisk()}%</span>
                  </div>
              </div>
            </div>
          </div>

          {/* Active Perspective Frame View */}
          <div id="active-perspective-card" className={`col-span-1 md:col-span-9 rounded-3xl p-6 border shadow-sm flex flex-col justify-between relative ${
            biasValue >= -10 && biasValue <= 10 
              ? "bg-stone-50/70 border-stone-200" 
              : biasValue < 0 
                ? "bg-blue-50 border-blue-100 highlight-bias-left" 
                : "bg-red-50 border-red-100 highlight-bias-right"
          }`}>
            {biasValue >= -10 && biasValue <= 10 && !isSideBySide ? (
              <div className="absolute inset-0 bg-stone-50/90 rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center">
                <SlidersHorizontal className="w-12 h-12 text-slate-400 mb-2 animate-pulse" />
                <h4 className="text-base font-bold text-slate-800">Partisan Slant Lens Inactive</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Use the slider above to view slanted articles. Or use Side-by-Side View.
                </p>
                <button 
                  onClick={() => setIsSideBySide(true)}
                  aria-label="Enable Side-by-Side View"
                  className="mt-6 px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-300 text-slate-700 shadow-sm hover:bg-slate-50"
                 >
                   Enable Side-by-Side View
                </button>
              </div>
            ) : null}

            <div className="flex flex-col h-full w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full mb-4 gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                    {biasState.outlet}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                    biasValue < 0 ? "bg-blue-100 text-blue-700" : biasValue > 0 ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"
                  }`}>
                    {biasValue < 0 ? "Left Narrative" : biasValue > 0 ? "Right Narrative" : "Neutral Perspective"}
                  </span>
                </div>
                
                <button 
                  onClick={() => setIsSideBySide(!isSideBySide)}
                  aria-label="Toggle Side-by-Side View"
                  aria-pressed={isSideBySide}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSideBySide ? "bg-slate-800 text-white shadow" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  {isSideBySide ? "Exit Side-by-Side View" : "Enable Side-by-Side View"}
                </button>
              </div>

              {isSideBySide ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 w-full flex-grow">
                  {/* Neutral Pane */}
                  <div className="flex flex-col gap-2 h-full">
                    <h5 className="text-[10px] font-bold uppercase text-slate-400 font-mono tracking-wider">Neutral Baseline</h5>
                    <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl shadow-inner text-slate-700 leading-relaxed font-serif text-[15px] tracking-normal flex-grow overflow-y-auto">
                      {dailyData.centerText}
                    </div>
                  </div>
                  {/* Partisan Pane */}
                  <div className="flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-center mb-1">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: biasValue < 0 ? '#2563eb' : biasValue > 0 ? '#dc2626' : '#64748b' }}>
                        Selected Overlay: {biasState.label} <span className="opacity-60">({currentViewpointHeadline})</span>
                      </h5>
                      <button 
                        onClick={generateTldr} 
                        className={`text-[9px] font-bold px-2 py-1 flex items-center gap-1 rounded transition-colors ${showTldr ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'}`}
                      >
                         <Sparkles className="w-3 h-3" />
                         {showTldr ? "HIDE TL;DR" : "GEMINI TL;DR"}
                      </button>
                    </div>
                    {showTldr && (
                        <div className="bg-slate-800 p-3 rounded-lg text-white text-xs mb-2 shadow-sm font-sans flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                            <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                {tldrLoading ? "Generating AI summary..." : tldrText}
                            </div>
                        </div>
                    )}
                    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-slate-800 leading-relaxed whitespace-pre-line font-serif text-[15px] tracking-normal flex-grow overflow-y-auto relative"
                         onMouseOver={handleTextInteraction}
                         onMouseOut={handleTextInteraction}
                         dangerouslySetInnerHTML={{__html: getCurrentHtml()}}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-start w-full">
                  <div className="w-full flex justify-between items-end mb-3">
                     <h4 className="text-xl font-serif font-bold text-slate-900 leading-tight italic max-w-[80%]">
                       Headline: {currentViewpointHeadline}
                     </h4>
                     <button 
                       onClick={generateTldr} 
                       className={`text-[10px] font-bold px-2.5 py-1.5 flex items-center gap-1 rounded-lg transition-colors shadow-sm ${showTldr ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'}`}
                     >
                        <Sparkles className="w-3.5 h-3.5" />
                        {showTldr ? "Close TL;DR" : "AI TL;DR"}
                     </button>
                  </div>
                  {showTldr && (
                      <div className="bg-slate-800 p-4 w-full rounded-xl text-white text-sm mb-4 shadow-sm font-sans flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                          <Sparkles className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                              {tldrLoading ? "Generating AI summary..." : tldrText}
                          </div>
                      </div>
                  )}
                  <div className="w-full bg-white border border-slate-200 p-4 rounded-2xl shadow-sm text-slate-800 leading-relaxed whitespace-pre-line font-serif text-[17px] tracking-normal min-h-[160px] max-h-[300px] overflow-y-auto relative"
                       onMouseOver={handleTextInteraction}
                       onMouseOut={handleTextInteraction}
                       dangerouslySetInnerHTML={{__html: getCurrentHtml()}}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Keyword Analysis / Adjective Audit Box */}
          <div id="adjective-audit-card" className="col-span-1 md:col-span-3 bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between min-h-[240px]">
            <div>
              <h3 className="font-black text-xs uppercase mb-4 tracking-widest text-slate-400 font-mono">Found Modifiers</h3>
              
              <div aria-live="polite" className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                {currentWords.length > 0 ? currentWords.map((word, i) => (
                    <span 
                      key={i}
                      className={`px-2 py-1 border text-[10px] rounded transition-colors ${
                        biasValue < -10
                          ? "bg-blue-950/50 border-blue-800 text-blue-200" 
                          : biasValue > 10 
                          ? "bg-red-950/50 border-red-800 text-red-200"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      {word}
                    </span>
                  )) : (
                    <span className="text-xs text-slate-500 italic">No loaded keywords found in this specific perspective.</span>
                  )
                }
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase font-mono leading-relaxed">
                Lexicon match logic <span className="text-emerald-400">ACTIVE</span>.
              </p>
            </div>
          </div>

          {/* Educational Integrity Guides */}
          <div id="integrity-sandbox-guide" className="col-span-1 md:col-span-12 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-xs uppercase mb-4 tracking-widest text-slate-500 font-mono flex items-center gap-1.5 border-b pb-2 border-slate-100">
              <BookOpen className="w-4 h-4 text-slate-500" />
              Understanding Media Bias
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {BIAS_EDUCATIONAL_TIPS.map((tip, i) => (
                <div key={i} className="space-y-1.5 text-xs">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 inline-flex items-center justify-center font-mono text-[9px] text-slate-600 font-bold">
                      {i + 1}
                    </span>
                    {tip.title}
                  </h4>
                  <p className="text-slate-500 leading-relaxed font-light font-sans pl-1">
                    {tip.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 7-Day Volatility Trend */}
      {!isLoading && dailyData && activeView === 'lexicon' && (
        <div className="col-span-1 md:col-span-12 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mt-4 w-full">
            <h3 className="font-bold text-xs uppercase mb-4 tracking-widest text-slate-500 font-mono flex items-center gap-1.5 border-b pb-2 border-slate-100">
              <Activity className="w-4 h-4 text-slate-500" />
              7-Day Volatility Trend
            </h3>
            <div className="w-full mt-4">
              <ResponsiveContainer width="100%" height={192}>
                 <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <RechartsTooltip 
                       contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                       formatter={(val: number) => [`${val}%`, 'Volatility Gap']}
                    />
                    <Line type="monotone" dataKey="volatility" stroke="#F97316" strokeWidth={3} dot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                 </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 font-sans mt-2 text-center w-full">This represents the variance in loaded language usage on this specific topic across standard networks over the last week.</p>
        </div>
      )}

      {/* Footer / CTA links */}
      <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 font-medium font-mono pt-6 gap-4 border-t border-slate-200/50 pb-6 w-full">
        <div className="flex gap-4">
          <span>Objective News Aggregator</span>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="px-2">Share analysis:</span>
          <div className="flex gap-1.5">
            <button 
              onClick={() => {
                const text = `Explore partisan bias in today's news on BiasFree.\n\n${window.location.href}`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-[#1DA1F2] rounded-lg transition-colors border border-slate-100"
              aria-label="Share on Twitter"
            >
              <Twitter className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank');
              }}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-[#0A66C2] rounded-lg transition-colors border border-slate-100"
              aria-label="Share on LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast("Link copied to clipboard!");
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-[10px] font-bold flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              Copy Link
            </button>
          </div>
        </div>
      </footer>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white py-3 px-5 rounded-2xl shadow-xl z-50 text-xs font-mono font-bold" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}

      {hoveredWord && (
         <div 
           className="fixed z-[100] pointer-events-none transform -translate-x-1/2 -translate-y-[100%] bg-white border-2 border-slate-800 p-3 rounded-xl shadow-2xl flex flex-col gap-1 items-center min-w-[140px]"
           style={{ left: hoveredWord.x, top: hoveredWord.y - 12 }}
         >
            <span className="text-[10px] uppercase font-bold text-slate-400">Neutral Translation</span>
            <span className="text-slate-900 font-bold text-sm">
                {synonyms[hoveredWord.word] || "Neutral equivalent"}
            </span>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-b-2 border-r-2 border-slate-800 rotate-45"></div>
         </div>
      )}
      </div>
    </div>
  );
}

