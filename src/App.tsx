import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  BookOpen, 
  SlidersHorizontal
} from "lucide-react";
import { BIAS_EDUCATIONAL_TIPS } from "./data";

export default function App() {
  const [dailyData, setDailyData] = useState<{
    date: string;
    topic: string;
    farLeftText: string;
    centerLeftText: string;
    centerText: string;
    centerRightText: string;
    farRightText: string;
  } | null>(null);

  const [biasValue, setBiasValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/daily-slider.json')
      .then(res => res.json())
      .then(data => {
        setDailyData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load daily slider data:", err);
        setIsLoading(false);
      });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const getBiasLabelAndColor = (val: number) => {
    if (val <= -60) return { label: "Far-Left Slant", color: "text-blue-600 bg-blue-50 border-blue-200", border: "border-blue-500", highlightHover: "hover:bg-blue-100", theme: "left-heavy", outlet: "Progressive Feed" };
    if (val < -10) return { label: "Center-Left Lean", color: "text-indigo-500 bg-indigo-50 border-indigo-150", border: "border-indigo-400", highlightHover: "hover:bg-indigo-100", theme: "left-leaning", outlet: "Progressive Feed" };
    if (val >= 10 && val < 60) return { label: "Center-Right Lean", color: "text-amber-600 bg-amber-50 border-amber-150", border: "border-amber-400", highlightHover: "hover:bg-amber-100", theme: "right-leaning", outlet: "Conservative Feed" };
    if (val >= 60) return { label: "Far-Right Slant", color: "text-red-600 bg-red-50 border-red-200", border: "border-red-500", highlightHover: "hover:bg-red-100", theme: "right-heavy", outlet: "Conservative Feed" };
    return { label: "Strictly Objective Facts", color: "text-slate-700 bg-slate-100 border-slate-300", border: "border-slate-500", highlightHover: "hover:bg-gray-200", theme: "neutral", outlet: "Neutral Baseline" };
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

  // Helper to extract highlighted words
  const extractLoadedWords = (html: string) => {
    if (!html) return [];
    const regex = /<span class=["']?highlight-bias(?:-left|-right)?["']?>([^<]+)<\/span>/gi;
    const words: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        words.push(match[1]);
    }
    return [...new Set(words)]; // Unique words
  };

  const allBiasedWords = dailyData ? [
    ...extractLoadedWords(dailyData.farLeftText),
    ...extractLoadedWords(dailyData.centerLeftText),
    ...extractLoadedWords(dailyData.centerRightText),
    ...extractLoadedWords(dailyData.farRightText)
  ] : [];
  const totalUniqueBiasedWords = new Set(allBiasedWords).size;
  
  const currentWords = dailyData ? extractLoadedWords(getCurrentHtml()) : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col p-4 md:p-6 lg:p-8 font-sans items-center">
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
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4 w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            BF
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              BIAS<span className="text-slate-500">FREE</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Zero-API Static News Aggregator</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center justify-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Automated via GitHub Actions
          </span>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow items-stretch">
          
          {/* Core Headline Card */}
          <div id="core-headline-card" className="col-span-1 md:col-span-8 bg-white rounded-3xl p-6 border-b-4 border-slate-300 shadow-sm flex flex-col justify-between min-h-[180px]">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">
                  Daily Automatic Scan
                </span>
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase">
                  No APIs
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-slate-900 leading-tight">
                {dailyData.topic || "Current Top Story"}
              </h2>
            </div>
            <p className="text-slate-500 text-xs md:text-sm mt-3">
              Automated offline bias analysis. Scraped on: {dailyData.date}.
            </p>
          </div>

          {/* Stats Card */}
          <div id="stats-card" className="col-span-1 md:col-span-4 bg-slate-800 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-sm min-h-[180px]">
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
                className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue < -10 ? "text-blue-600 bg-blue-50 border border-blue-100" : "text-slate-400 hover:text-slate-600"}`}
              >
                Progressive Lens
              </button>
              <button 
                onClick={() => setBiasValue(0)}
                className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue >= -10 && biasValue <= 10 ? "text-slate-800 bg-slate-100 border border-slate-200 shadow-inner" : "text-slate-400 hover:text-slate-605"}`}
              >
                Neutral Core
              </button>
              <button 
                onClick={() => setBiasValue(75)}
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
                min="-100"
                max="100"
                value={biasValue}
                onChange={(e) => setBiasValue(parseInt(e.target.value))}
                className="w-full h-2 bg-transparent cursor-pointer appearance-none z-10 relative outline-none focus:ring-2 focus:ring-slate-300"
                style={{
                  accentColor: biasValue === 0 ? "#475569" : biasValue < 0 ? "#2563eb" : "#dc2626"
                }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-1">
              <span>Far-Left (-100)</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">Current Overlay:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${biasState.color}`}>
                  {biasState.label}
                </span>
              </div>
              <span>Far-Right (+100)</span>
            </div>
          </div>

          {/* Neutral Fact Summary Baseline */}
          <div id="neutral-baseline-card" className="col-span-1 md:col-span-4 bg-white rounded-3xl p-6 border-l-4 border-slate-900 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-black text-xs uppercase mb-4 tracking-widest text-slate-500 font-mono">Neutral Summary Facts</h3>
              <p className="text-xs md:text-sm leading-relaxed text-slate-800 italic">
                {dailyData.centerText}
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 mt-3">
              <span className="text-[9px] font-mono uppercase text-slate-400 block font-bold">Lexical Scanner</span>
              <p className="text-[11px] mt-2 text-slate-600 leading-relaxed font-sans">
                This center feed explicitly avoids the offline loaded vocabulary matched across {totalUniqueBiasedWords} flagged terms in the highly polarized partisan outlets.
              </p>
            </div>
          </div>

          {/* Active Perspective Frame View */}
          <div id="active-perspective-card" className={`col-span-1 md:col-span-5 rounded-3xl p-6 border shadow-sm flex flex-col justify-between relative ${
            biasValue >= -10 && biasValue <= 10 
              ? "bg-stone-50/70 border-stone-200" 
              : biasValue < 0 
                ? "bg-blue-50 border-blue-100 highlight-bias-left" 
                : "bg-red-50 border-red-100 highlight-bias-right"
          }`}>
            {biasValue >= -10 && biasValue <= 10 ? (
              <div className="absolute inset-0 bg-stone-50/90 rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center">
                <SlidersHorizontal className="w-12 h-12 text-slate-400 mb-2 animate-pulse" />
                <h4 className="text-base font-bold text-slate-800">Partisan Slant Lens Inactive</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Slide spectrum slider left or right above to overlay highlighted slanted articles. 
                </p>
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                  {biasState.outlet}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                  biasValue < 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                }`}>
                  {biasValue < 0 ? "Left Narrative" : "Right Narrative"}
                </span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xl font-serif font-bold text-slate-900 leading-tight italic">
                  Headline: {dailyData.topic}
                </h4>
                <div className="bg-white/90 border border-slate-200/80 p-4 rounded-2xl min-h-[160px] shadow-inner text-slate-800 leading-relaxed whitespace-pre-line font-serif text-lg tracking-normal max-h-[300px] overflow-y-auto"
                     dangerouslySetInnerHTML={{__html: getCurrentHtml().replace(/<span class='highlight-bias'>/g, `<span class='highlight-bias ${biasValue < 0 ? "highlight-bias-left" : "highlight-bias-right"}'>`)}}
                />
              </div>
            </div>
          </div>

          {/* Keyword Analysis / Adjective Audit Box */}
          <div id="adjective-audit-card" className="col-span-1 md:col-span-3 bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between min-h-[240px]">
            <div>
              <h3 className="font-black text-xs uppercase mb-4 tracking-widest text-slate-400 font-mono">Found Modifiers</h3>
              
              <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1">
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
                Lexicon match logic <span className="text-emerald-400">ACTIVE</span>. Modifiers highlight partisan leaning based on <span className="text-indigo-300">data/lexicon.csv</span>.
              </p>
            </div>
          </div>

          {/* Educational Integrity Guides */}
          <div id="integrity-sandbox-guide" className="col-span-1 md:col-span-12 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-xs uppercase mb-4 tracking-widest text-slate-500 font-mono flex items-center gap-1.5 border-b pb-2 border-slate-100">
              <BookOpen className="w-4 h-4 text-slate-500" />
              Understanding Media Bias (Static Local List)
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

      {/* Footer / CTA links */}
      <footer className="mt-6 flex justify-between items-center text-[11px] text-slate-400 font-medium font-mono pt-6 gap-4 border-t border-slate-200/50 pb-6 w-full">
        <div className="flex gap-4">
          <span>Static Offline Pipeline</span>
          <span>Zero-API Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Share analyzer:</span>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              showToast("Link copied to clipboard!");
            }}
            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors text-[10px] font-bold"
          >
            Copy App Link
          </button>
        </div>
      </footer>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white py-3 px-5 rounded-2xl shadow-xl z-50 text-xs font-mono font-bold">
          <span>{toastMessage}</span>
        </div>
      )}
      </div>
    </div>
  );
}
