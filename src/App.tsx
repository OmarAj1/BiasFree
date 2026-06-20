import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  AlertTriangle, 
  BookOpen, 
  SlidersHorizontal,
  Clock,
  Calendar,
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  ArrowLeft,
  Sparkles,
  Activity
} from "lucide-react";
import { BIAS_EDUCATIONAL_TIPS } from "./data";
import BiasSpectrum from "./components/BiasSpectrum";
import { LineChart, Line, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
            const reversed = data.reverse();
            setDailyDataList(reversed);
            if (reversed.length > 0) {
              setSelectedDate(reversed[0].date);
            }
          }
          else if (data) {
            setDailyDataList([data]);
            setSelectedDate(data.date);
          }
          
          setIsLoading(false);
          return; // Success, stop trying other URLs
        } catch (err) {
          console.warn(`Failed to process data from ${url}:`, err);
        }
      }
      
      setIsLoading(false);
      console.error("All data sources failed to load.");
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

  // Helper to extract highlighted words
  const extractLoadedWords = (html: string) => {
    if (!html) return [];
    const regex = /<span[^>]*class=["'][^"']*highlight-bias[^"']*["'][^>]*>([^<]+)<\/span>/gi;
    const words: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        words.push(match[1]);
    }
    return [...new Set(words)]; // Unique words
  };

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

  // Mock trend data
  const trendData = useMemo(() => {
      return [...Array(7)].map((_, i) => {
         const d = new Date();
         d.setDate(d.getDate() - (6 - i));
         return {
             name: d.toLocaleDateString('en-US', { weekday: 'short' }),
             volatility: Math.floor(Math.random() * 40) + 15 
         };
      });
  }, [dailyData?.id]);

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
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-orange-200 shadow-sm gap-4 w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            BF
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              BIAS<span className="text-orange-500">FREE</span>
            </h1>
          </div>
        </div>

        {uniqueDates.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 shadow-sm">
                🎯 Complete: {completeStories.length}
              </span>
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 shadow-sm">
                ⚠️ Partial: {partialStories.length}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer uppercase tracking-wider"
                aria-label="Select Date"
              >
                {uniqueDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
          </div>
        )}
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
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold rounded uppercase">
                  Daily Scan
                </span>
                <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] items-center flex font-bold rounded uppercase border border-orange-100">
                  <Clock className="w-3 h-3 mr-1" />
                  {calculateReadingTime(getCurrentHtml())} min read
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-slate-900 leading-tight">
                {dailyData.topic || "Current Top Story"}
              </h2>
              
              {/* Daily stories picker (if multiple) */}
              {filteredStories.length > 1 && (
                <div role="group" aria-label="News Topics Selector" className="flex bg-white rounded-lg p-1.5 shadow-sm border border-slate-200 mt-5 overflow-x-auto gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 py-1.5 px-2">Top Stories:</span>
                  {filteredStories.map((story, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveStoryIndex(i)}
                      aria-current={i === activeStoryIndex ? "true" : "false"}
                      className={`whitespace-nowrap px-3 py-1 text-xs font-bold rounded-md transition-colors ${i === activeStoryIndex ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-200'}`}
                    >
                      Topic {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <p className="text-slate-500 text-xs md:text-sm mt-3">
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
                        Selected Overlay: {biasState.label}
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
                       Headline: {dailyData.topic}
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

