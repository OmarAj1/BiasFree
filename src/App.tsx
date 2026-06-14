import React, { useState, useEffect } from "react";
import { 
  Newspaper, 
  AlertTriangle, 
  Info, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  SlidersHorizontal, 
  RotateCcw, 
  Send, 
  Check, 
  Share2, 
  Plus,
  HelpCircle,
  FileText,
  Bookmark,
  ChevronRight,
  TrendingUp,
  Award
} from "lucide-react";
import { PRE_PACKAGED_STORIES, BIAS_EDUCATIONAL_TIPS } from "./data";
import { BiasStory, BiasedAdjective, FramingData } from "./types";

export default function App() {
  // Preselected stories + Custom stories in localStorage
  const [stories, setStories] = useState<BiasStory[]>(PRE_PACKAGED_STORIES);
  const [currentStoryId, setCurrentStoryId] = useState<string>("infrastructure-spend-2026");
  
  // Custom analyze states
  const [customInput, setCustomInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisError, setAnalysisError] = useState("");

  // Slide Bias Value: -100 (Far Left) to 0 (Strict Neutral) to +100 (Far Right)
  const [biasValue, setBiasValue] = useState<number>(0);

  // Loaded adjectives selected for popup explanation
  const [selectedAdjective, setSelectedAdjective] = useState<BiasedAdjective | null>(null);
  const [selectedSide, setSelectedSide] = useState<"left" | "right" | "neutral">("neutral");

  // User "Neutralized" words - local dictionary of neutralized terms to let them "Factualize" the story!
  const [neutralizedPhrases, setNeutralizedPhrases] = useState<string[]>([]);

  // Selected story object
  const currentStory = stories.find(s => s.id === currentStoryId) || stories[0];

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger loading step simulations when analyzing custom inputs
  useEffect(() => {
    let timer: any;
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalysisStep((step) => {
          if (step >= 3) {
            clearInterval(interval);
            return 3;
          }
          return step + 1;
        });
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setAnalysisStep(0);
    }
  }, [isAnalyzing]);

  // Load saved custom stories from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bias_stories_library");
      if (saved) {
        const parsed: BiasStory[] = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          // Merge pre-packaged and saved ones, checking for duplicates
          const uniqueSaved = parsed.filter(ps => !PRE_PACKAGED_STORIES.some(p => p.id === ps.id));
          setStories([...PRE_PACKAGED_STORIES, ...uniqueSaved]);
        }
      }
    } catch (e) {
      console.error("Failed to load custom stories", e);
    }
  }, []);

  // Helper to show a fast temporary toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handle local persistence of newly generated analysis
  const handleAddCustomStory = (newStory: BiasStory) => {
    const updated = [newStory, ...stories.filter(s => s.id !== newStory.id)];
    setStories(updated);
    setCurrentStoryId(newStory.id);
    
    // Save to localStorage
    try {
      const customOnly = updated.filter(s => s.isCustom);
      localStorage.setItem("bias_stories_library", JSON.stringify(customOnly));
    } catch (e) {
      console.error("Failed to save custom stories", e);
    }
  };

  // Trigger actual server call for a custom prompt
  const handleAnalyzeCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    setIsAnalyzing(true);
    setAnalysisStep(0);
    setAnalysisError("");
    setSelectedAdjective(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ input: customInput })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to analyze text. Please check your connection.");
      }

      const parsedResult: any = await response.json();
      
      const newStory: BiasStory = {
        id: "custom-" + Date.now(),
        title: parsedResult.title || customInput.slice(0, 50) + "...",
        category: parsedResult.category || "General News",
        date: "Analyzed Today",
        neutralSummary: parsedResult.neutralSummary || [],
        leftFraming: parsedResult.leftFraming,
        rightFraming: parsedResult.rightFraming,
        isCustom: true
      };

      handleAddCustomStory(newStory);
      setCustomInput("");
      setBiasValue(0); // Reset slider to center neutral
      showToast("Custom news bias simulation loaded!");
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteCustomStory = (storyId: string) => {
    const nextStories = stories.filter(s => s.id !== storyId);
    setStories(nextStories);
    
    try {
      const customOnly = nextStories.filter(s => s.isCustom);
      localStorage.setItem("bias_stories_library", JSON.stringify(customOnly));
    } catch (e) {
      console.error(e);
    }

    if (currentStoryId === storyId) {
      setCurrentStoryId(PRE_PACKAGED_STORIES[0].id);
      setBiasValue(0);
    }
    showToast("Story deleted from library.");
  };

  // Determine current bias state description
  const getBiasLabelAndColor = (val: number) => {
    if (val <= -60) return { label: "Far-Left Slant", color: "text-blue-600 bg-blue-50 border-blue-200", border: "border-blue-500", highlightHover: "hover:bg-blue-100", theme: "left-heavy" };
    if (val < -10) return { label: "Center-Left Lean", color: "text-indigo-500 bg-indigo-50 border-indigo-150", border: "border-indigo-400", highlightHover: "hover:bg-indigo-100", theme: "left-leaning" };
    if (val >= 10 && val < 60) return { label: "Center-Right Lean", color: "text-amber-600 bg-amber-50 border-amber-150", border: "border-amber-400", highlightHover: "hover:bg-amber-100", theme: "right-leaning" };
    if (val >= 60) return { label: "Far-Right Slant", color: "text-red-600 bg-red-50 border-red-200", border: "border-red-500", highlightHover: "hover:bg-red-100", theme: "right-heavy" };
    return { label: "Strictly Objective Facts", color: "text-slate-700 bg-slate-100 border-slate-300", border: "border-slate-500", highlightHover: "hover:bg-gray-200", theme: "neutral" };
  };

  const biasState = getBiasLabelAndColor(biasValue);

  // Retrieve current side text framing
  const currentFramingSide = biasValue < 10 ? "left" : "right";

  // Segmenter / Highlighter function to replace raw bias adjectives with clickable HTML blocks
  const renderInteractiveText = (text: string, adjectives: BiasedAdjective[]) => {
    if (!text) return null;
    if (!adjectives || adjectives.length === 0) return <p className="text-slate-800 leading-relaxed whitespace-pre-line">{text}</p>;

    // Sort adjectives descending by phrase length to prevent short sub-words hijacking longer phrases
    const sorted = [...adjectives].sort((a,b) => b.phrase.length - a.phrase.length);

    // We tokenize text to replace exact matches
    const tokens: Array<{ text: string; isHighlight: boolean; data?: BiasedAdjective }> = [];
    let searchString = text;
    let indexMap: Array<{ start: number; end: number; adj: BiasedAdjective }> = [];

    // Find all occurrences of any phrase
    sorted.forEach((adj) => {
      let pos = text.indexOf(adj.phrase);
      while (pos !== -1) {
        // Confirm this position doesn't overlap already mapped ranges
        const isOverlap = indexMap.some(r => (pos >= r.start && pos < r.end) || (pos + adj.phrase.length > r.start && pos + adj.phrase.length <= r.end));
        if (!isOverlap) {
          indexMap.push({
            start: pos,
            end: pos + adj.phrase.length,
            adj
          });
        }
        pos = text.indexOf(adj.phrase, pos + 1);
      }
    });

    // Sort mappings by starting position
    indexMap.sort((a,b) => a.start - b.start);

    let lastIndex = 0;
    indexMap.forEach((map) => {
      // Append text before the match
      if (map.start > lastIndex) {
        tokens.push({
          text: text.substring(lastIndex, map.start),
          isHighlight: false
        });
      }
      // Add the match
      tokens.push({
        text: text.substring(map.start, map.end),
        isHighlight: true,
        data: map.adj
      });
      lastIndex = map.end;
    });

    // Append remaining text
    if (lastIndex < text.length) {
      tokens.push({
        text: text.substring(lastIndex),
        isHighlight: false
      });
    }

    return (
      <div className="text-slate-800 leading-relaxed whitespace-pre-line font-serif text-lg tracking-normal">
        {tokens.map((token, i) => {
          if (!token.isHighlight || !token.data) {
            return <span key={i}>{token.text}</span>;
          }

          const hasNeutralized = neutralizedPhrases.includes(token.data.phrase);
          
          if (hasNeutralized) {
            // Render the cleaned neutral alternative in an encouraging success highlight
            return (
              <span
                key={i}
                className="inline-block px-1 mx-0.5 rounded cursor-pointer border-b-2 border-emerald-500 bg-emerald-50 text-emerald-900 transition-all font-sans font-medium"
                title={`Neutralized: Original text was '${token.text}'`}
                onClick={() => {
                  setSelectedAdjective(token.data || null);
                  setSelectedSide(biasValue < 0 ? "left" : "right");
                }}
              >
                {token.data.alternative}
              </span>
            );
          }

          // Otherwise render the alert highlighters based on political lean
          const isLeft = biasValue < 0;
          const bgClassName = isLeft 
            ? "border-b-2 border-blue-500 bg-blue-50/55 hover:bg-blue-100/80 text-blue-900"
            : "border-b-2 border-red-500 bg-red-50/55 hover:bg-red-100/80 text-red-900";

          return (
            <span
              key={i}
              className={`inline px-1 py-0.5 rounded cursor-pointer transition-colors font-medium decoration-solid ${bgClassName}`}
              onClick={() => {
                setSelectedAdjective(token.data || null);
                setSelectedSide(biasValue < 0 ? "left" : "right");
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    );
  };

  const handleNeutralize = (phrase: string) => {
    if (!neutralizedPhrases.includes(phrase)) {
      setNeutralizedPhrases([...neutralizedPhrases, phrase]);
      showToast("Loaded adjective swapped with factual alternative!");
    }
  };

  // Reset the neutralized modifiers list
  const handleResetNeutralizers = () => {
    setNeutralizedPhrases([]);
    showToast("Reverted all bias neutralized words.");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col p-4 md:p-6 font-sans">
      
      {/* Header Section (Bento style) */}
      <header className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4 w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            B
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              BIAS<span className="text-indigo-600">SLENS</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Live Media Integrity Lab • v1.2</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center justify-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Last Updated: Oct 24, 2026 • 14:02 GMT
          </span>
          <button 
            onClick={() => showToast("Subscribed! Daily briefs will proceed.")}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold transition-all hover:scale-[1.02]"
          >
            Get Daily Brief
          </button>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow items-stretch">
        
        {/* Core Headline Card (col-span-8 row-span-2) */}
        <div id="core-headline-card" className="col-span-1 md:col-span-8 bg-white rounded-3xl p-6 border-b-4 border-slate-300 shadow-sm flex flex-col justify-between min-h-[180px]">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase">
                {currentStory.category}
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">
                Active Audit baseline
              </span>
              {currentStory.isCustom && (
                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase">
                  Custom Scan
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3.5xl font-serif font-bold text-slate-900 leading-tight">
              {currentStory.title}
            </h2>
          </div>
          <p className="text-slate-500 text-xs md:text-sm mt-3">
            Simultaneous multi-source dissection across 142 viewpoints. Published/Analyzed: {currentStory.date || "Today"}.
          </p>
        </div>

        {/* Stats Card (col-span-4 row-span-2) */}
        <div id="stats-card" className="col-span-1 md:col-span-4 bg-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between shadow-sm min-h-[180px]">
          <div className="relative z-10 space-y-4">
            <h3 className="text-xs font-bold uppercase opacity-80 tracking-widest font-mono">
              Framing Intensity
            </h3>
            <div>
              <div className="text-5xl font-black mb-1">
                {Math.min(95, 45 + ((currentStory.leftFraming.adjectives?.length || 0) + (currentStory.rightFraming.adjectives?.length || 0)) * 5)}%
              </div>
              <p className="text-xs opacity-90 leading-relaxed italic font-light pt-2 border-t border-white/20">
                "High polarity detected in keyword choices between alternative editorial frameworks on this subject."
              </p>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* The Slider Component (Full Width Row, col-span-12) */}
        <div id="lens-slider-row" className="col-span-1 md:col-span-12 bg-white rounded-3xl p-6 flex flex-col justify-center border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <button 
              onClick={() => { setBiasValue(-75); setSelectedAdjective(null); }}
              className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue < -10 ? "text-blue-600 bg-blue-50 border border-blue-100" : "text-slate-400 hover:text-slate-600"}`}
            >
              Progressive Lens
            </button>
            <button 
              onClick={() => { setBiasValue(0); setSelectedAdjective(null); }}
              className={`text-xs font-black uppercase tracking-tighter transition-all px-3 py-1 rounded-full ${biasValue >= -10 && biasValue <= 10 ? "text-slate-800 bg-slate-100 border border-slate-200 shadow-inner" : "text-slate-400 hover:text-slate-605"}`}
            >
              Neutral Core
            </button>
            <button 
              onClick={() => { setBiasValue(75); setSelectedAdjective(null); }}
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
              onChange={(e) => {
                setBiasValue(parseInt(e.target.value));
                setSelectedAdjective(null);
              }}
              className="w-full h-2 bg-transparent cursor-pointer appearance-none z-10 relative outline-none focus:ring-2 focus:ring-indigo-300"
              style={{
                accentColor: biasValue === 0 ? "#475569" : biasValue < 0 ? "#2563eb" : "#dc2626"
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-1">
            <span>Far-Left Slant (-100)</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Current Overlay:</span>
              <span className={`px-2 py-0.5 rounded font-bold ${biasState.color}`}>
                {biasState.label}
              </span>
              {neutralizedPhrases.length > 0 && (
                <button
                  onClick={handleResetNeutralizers}
                  className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded hover:bg-emerald-100 transition-colors font-bold uppercase text-[9px] cursor-pointer"
                >
                  Reset Vocabulary ({neutralizedPhrases.length})
                </button>
              )}
            </div>
            <span>Far-Right Slant (+100)</span>
          </div>
        </div>

        {/* Neutral Fact Summary Baseline (col-span-12 md:col-span-4) */}
        <div id="neutral-baseline-card" className="col-span-1 md:col-span-4 bg-white rounded-3xl p-6 border-l-4 border-slate-900 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-black text-xs uppercase mb-4 tracking-widest text-slate-505 text-slate-500">Neutral Summary Facts</h3>
            <ul className="space-y-4">
              {currentStory.neutralSummary.map((bullet, idx) => (
                <li key={idx} className="flex gap-2.5 text-xs md:text-sm leading-relaxed text-slate-800">
                  <span className="text-indigo-650 font-bold text-indigo-600">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 mt-3">
            <span className="text-[9px] font-mono uppercase text-slate-400 block font-bold">Omission Analysis Matrix</span>
            <div className="space-y-1.5 mt-2 text-[11px]">
              {currentStory.neutralSummary.slice(0, 3).map((fact, index) => {
                const leftOmitted = index >= (currentStory.neutralSummary.length - 2);
                const rightOmitted = index >= 1 && index < 3;
                return (
                  <div key={index} className="flex justify-between items-center text-slate-700 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                    <span className="truncate max-w-[140px] font-sans font-medium">{fact}</span>
                    <div className="flex gap-3 text-[10px] font-mono">
                      <span className={leftOmitted ? "text-amber-600 font-bold" : "text-emerald-600 font-semibold"}>
                        L:{leftOmitted ? "OMIT" : "REP"}
                      </span>
                      <span className={rightOmitted ? "text-amber-600 font-bold" : "text-emerald-600 font-semibold"}>
                        R:{rightOmitted ? "OMIT" : "REP"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Perspective Frame View (col-span-12 md:col-span-5) */}
        <div id="active-perspective-card" className={`col-span-1 md:col-span-5 rounded-3xl p-6 border shadow-sm flex flex-col justify-between relative ${
          biasValue >= -10 && biasValue <= 10 
            ? "bg-stone-50/70 border-stone-200" 
            : biasValue < 0 
              ? "bg-blue-50 border-blue-100" 
              : "bg-red-50 border-red-100"
        }`}>
          {biasValue >= -10 && biasValue <= 10 ? (
            <div className="absolute inset-0 bg-stone-50/90 rounded-3xl z-20 flex flex-col items-center justify-center p-6 text-center">
              <SlidersHorizontal className="w-12 h-12 text-slate-400 mb-2 animate-pulse" />
              <h4 className="text-base font-bold text-slate-800">Partisan Slant Lens Inactive</h4>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Slide spectrum slider left or right above to overlay highlighted slanted articles. Click highlighted words to edit.
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                {biasValue < 0 ? currentStory.leftFraming.outletName : currentStory.rightFraming.outletName}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                biasValue < 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
              }`}>
                {biasValue < 0 ? "Left Narrative" : "Right Narrative"}
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="text-xl font-serif font-bold text-slate-900 leading-tight italic">
                "{biasValue < 0 ? currentStory.leftFraming.headline : currentStory.rightFraming.headline}"
              </h4>
              <div className="bg-white/90 border border-slate-200/80 p-4 rounded-2xl min-h-[160px] shadow-inner">
                {renderInteractiveText(
                  biasValue < 0 ? currentStory.leftFraming.storyText : currentStory.rightFraming.storyText,
                  biasValue < 0 ? currentStory.leftFraming.adjectives : currentStory.rightFraming.adjectives
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 font-mono">Omitted Facts In This Framework</p>
              <ul className="text-xs text-amber-800 leading-relaxed italic space-y-1 pl-1 list-disc list-inside">
                {(biasValue < 0 ? currentStory.leftFraming.omittedFacts : currentStory.rightFraming.omittedFacts).slice(0, 2).map((fact, idx) => (
                  <li key={idx}>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Keyword Analysis / Adjective Audit Box (col-span-12 md:col-span-3) */}
        <div id="adjective-audit-card" className="col-span-1 md:col-span-3 bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between min-h-[240px]">
          <div>
            <h3 className="font-black text-xs uppercase mb-4 tracking-widest text-indigo-400 font-mono">Adjective Audit</h3>
            
            <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1">
              {currentStory.leftFraming.adjectives.map((item, i) => {
                const isNeu = neutralizedPhrases.includes(item.phrase);
                return (
                  <span 
                    key={`l-${i}`}
                    onClick={() => { setBiasValue(-50); setSelectedAdjective(item); }}
                    className={`px-2 py-1 border text-[10px] rounded cursor-pointer transition-colors ${
                      isNeu 
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 line-through" 
                        : "bg-blue-950/50 border-blue-800 text-blue-200 hover:bg-blue-900"
                    }`}
                  >
                    {item.phrase}
                  </span>
                );
              })}
              {currentStory.rightFraming.adjectives.map((item, i) => {
                const isNeu = neutralizedPhrases.includes(item.phrase);
                return (
                  <span 
                    key={`r-${i}`}
                    onClick={() => { setBiasValue(50); setSelectedAdjective(item); }}
                    className={`px-2 py-1 border text-[10px] rounded cursor-pointer transition-colors ${
                      isNeu 
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-300 line-through" 
                        : "bg-red-950/50 border-red-800 text-red-200 hover:bg-red-900"
                    }`}
                  >
                    {item.phrase}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(neutralizedPhrases.length / Math.max(1, (currentStory.leftFraming.adjectives.length + currentStory.rightFraming.adjectives.length))) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-mono">
              Integrity index: {Math.round(((neutralizedPhrases.length) / Math.max(1, (currentStory.leftFraming.adjectives.length + currentStory.rightFraming.adjectives.length))) * 10)}/10
            </p>
          </div>
        </div>

        {/* Flagged Word Explanatory popups absolute inline card (renders dynamic focus) */}
        {selectedAdjective && (
          <div id="dynamic-biopsy-card" className="col-span-1 md:col-span-12 transition-all">
            <div className={`p-6 rounded-3xl border shadow-md flex flex-col md:flex-row justify-between gap-6 ${
              biasValue < 0 ? "bg-blue-50 border-blue-400" : "bg-red-50 border-red-400"
            }`}>
              <div className="flex-grow space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                    Active Adjective Analysis
                  </span>
                  <button onClick={() => setSelectedAdjective(null)} className="text-slate-400 hover:text-slate-700 font-bold p-1">✕</button>
                </div>
                <h4 className="text-lg font-black text-slate-900 leading-tight">
                  Phrase: <span className="underline italic">"{selectedAdjective.phrase}"</span>
                </h4>
                <p className="text-xs md:text-sm text-slate-700 leading-relaxed bg-white/70 p-3.5 rounded-xl border border-white/90 shadow-sm mt-2">
                  {selectedAdjective.explanation}
                </p>
              </div>

              <div className="w-full md:w-80 space-y-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">Neutral Factual Replacement</span>
                  <div className="bg-emerald-50 border border-emerald-300 p-3 mt-1 rounded-xl flex items-center justify-between text-sm">
                    <span className="font-bold text-emerald-950 font-mono">"{selectedAdjective.alternative}"</span>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>

                {!neutralizedPhrases.includes(selectedAdjective.phrase) ? (
                  <button
                    onClick={() => handleNeutralize(selectedAdjective.phrase)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Award className="w-4 h-4" />
                    <span>Confirm Neutralization</span>
                  </button>
                ) : (
                  <div className="text-center font-mono text-[10px] text-emerald-600 bg-emerald-200/50 border border-emerald-300 py-2 rounded-xl font-bold flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>Visual slant corrected!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Custom Bias Scanner Workspace Bento Box (col-span-12 lg:col-span-7) */}
        <div id="scanner-workspace-card" className="col-span-1 md:col-span-7 bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-sm min-h-[240px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <h2 className="font-bold text-sm tracking-wide uppercase font-mono">AI Bias Scanner Workspace</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              Submit custom current news text blobs. The Gemini model segmenter will immediately write unbiased baselines, simulate progressive/conservative editorial variants, and tag sentiment adjectives.
            </p>
          </div>

          <form onSubmit={handleAnalyzeCustom} className="space-y-3">
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Paste article text or prompt: 'State of local community energy grid allocations'..."
              className="w-full h-24 p-3.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:bg-slate-800 transition-all resize-none outline-none text-slate-100 placeholder:text-slate-500"
              maxLength={1000}
              required
              disabled={isAnalyzing}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">
                {customInput.length}/1000 chars
              </span>
              <button
                type="submit"
                disabled={isAnalyzing || !customInput.trim()}
                className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Scan Media Bias</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {isAnalyzing && (
            <div className="bg-indigo-900/30 rounded-xl p-3 border border-indigo-500/30 space-y-1 text-[10px] font-mono text-indigo-300 mt-2">
              <div className="flex justify-between items-center text-[9px] mb-1">
                <span>BIASLENS PARSING ENGINE</span>
                <span>{Math.round((analysisStep + 1) * 25)}%</span>
              </div>
              <div className="h-1 bg-indigo-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000 rounded-full"
                  style={{ width: `${(analysisStep + 1) * 25}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-indigo-200/80 mt-1 truncate">
                {analysisStep === 0 && "Step 1/4: Digesting central factual timeline..."}
                {analysisStep === 1 && "Step 2/4: Cataloging sentiment anomalies..."}
                {analysisStep === 2 && "Step 3/4: Simulating left/right narrative frames..."}
                {analysisStep >= 3 && "Step 4/4: Structuring clickable active modifiers..."}
              </div>
            </div>
          )}

          {analysisError && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-300">
              <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p>{analysisError}</p>
            </div>
          )}
        </div>

        {/* Audit Library / Presets Bento Box (col-span-12 lg:col-span-5) */}
        <div id="library-presets-card" className="col-span-1 md:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between min-h-[240px]">
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-505 text-slate-500 font-mono flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-indigo-600" />
              Audit Library Catalog
            </h3>
            <p className="text-xs text-slate-400 font-light font-mono leading-relaxed">Select presets or view custom items in sandbox storage:</p>
            
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {stories.map((story) => {
                const isActive = story.id === currentStoryId;
                return (
                  <button
                    key={story.id}
                    onClick={() => {
                      setCurrentStoryId(story.id);
                      setBiasValue(0);
                      setSelectedAdjective(null);
                      setNeutralizedPhrases([]);
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 overflow-hidden ${
                      isActive 
                        ? "bg-slate-900 border-slate-905 text-white shadow-sm" 
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className="truncate flex-1 font-semibold pr-2">{story.title}</div>
                    {story.isCustom && (
                      <span className="text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded flex-shrink-0 font-bold uppercase">My Scan</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            {currentStory.isCustom ? (
              <button 
                onClick={() => handleDeleteCustomStory(currentStory.id)}
                className="w-full text-center py-2 border border-red-200 rounded-xl text-red-500 hover:bg-red-50 text-xs transition-colors font-bold"
              >
                Delete Custom Audit
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono italic">Preset stories compiled using independent feedback loops.</span>
            )}
          </div>
        </div>

        {/* Educational Integrity Guides (col-span-12) */}
        <div id="integrity-sandbox-guide" className="col-span-1 md:col-span-12 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="font-bold text-xs uppercase mb-4 tracking-widest text-slate-500 font-mono flex items-center gap-1.5 border-b pb-2 border-slate-100">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            Integrity Sandbox Guides
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {BIAS_EDUCATIONAL_TIPS.map((tip, i) => (
              <div key={i} className="space-y-1.5 text-xs">
                <h4 className="font-bold text-indigo-905 text-indigo-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 inline-flex items-center justify-center font-mono text-[9px] text-indigo-600 font-bold">
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

      {/* Footer / CTA links */}
      <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 font-medium font-mono pt-6 gap-4 border-t border-slate-200/50">
        <div className="flex gap-4">
          <span>About Our Methodology</span>
          <span>Transparency Report</span>
          <span>For Educators</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Share this analysis:</span>
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

      {/* Persistent dynamic interactive success toast alerts */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white py-3 px-5 rounded-2xl shadow-xl flex items-center gap-3 z-50 text-xs font-mono font-bold animate-slide-up leading-none">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
