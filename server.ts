import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST endpoint for performing the bias analysis on a custom input
app.post("/api/analyze", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== "string" || input.trim().length === 0) {
      res.status(400).json({ error: "Please provide a valid text input to analyze." });
      return;
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Perform a detailed media bias analysis on this topic or news article text: "${input}"`,
      config: {
        systemInstruction: `You are BiasLens AI, a media analysis expert. Your job is to break down a topical news item, write a strictly neutral objective fact summary, and simulate how partisan left-leaning and right-leaning outlets frame the exact same story to highlight adjectives, loaded terms, and omitted facts.

Output a single valid JSON object following this JSON schema:
{
  "title": "Clear, objective title of the news story",
  "category": "Politics" | "Economy" | "Tech" | "Health" | "Environment" | "International",
  "neutralSummary": [
    "Objective bullet point 1 (factual, unembellished, focusing on raw data/verified events)",
    "Objective bullet point 2",
    "Objective bullet point 3"
  ],
  "leftFraming": {
    "headline": "A typical left-leaning emotional headline",
    "outletName": "The Progress Sentinel (Left-leaning alternative)",
    "storyText": "2-3 paragraphs of a left-leaning article. Write in genuine journalistic style. Use emotionally charged adjectives, partisan framings, and narrative focus matching left-leaning tendencies.",
    "adjectives": [
      {
        "phrase": "exact adjective or phrase in the storyText that shows bias or bias-by-adjective",
        "alternative": "neutral replacement word/phrase",
        "explanation": "Brief description of why this phrase is loaded, what trigger it operates on, and how it redirects focus."
      }
    ],
    "omittedFacts": [
      "A factual point from the neutralSummary that this left-leaning version completely omitted to serve its narrative."
    ]
  },
  "rightFraming": {
    "headline": "A typical right-leaning emotional headline",
    "outletName": "The Liberty Gazette (Right-leaning alternative)",
    "storyText": "2-3 paragraphs of a right-leaning article. Write in genuine journalistic style. Use emotionally charged adjectives, partisan framings, and narrative focus matching right-leaning tendencies.",
    "adjectives": [
      {
        "phrase": "exact adjective or phrase in the storyText that shows bias or bias-by-adjective",
        "alternative": "neutral replacement word/phrase",
        "explanation": "Brief description of why this phrase is loaded, what trigger it operates on, and how it redirects focus."
      }
    ],
    "omittedFacts": [
      "A factual point from the neutralSummary that this right-leaning version completely omitted to serve its narrative."
    ]
  }
}

CRITICAL RULES:
1. Every string inside the "phrase" properties of the leftFraming/rightFraming adjectives list MUST match exactly as a substring within its respective "storyText" field, case-sensitivelty, so we can replace them in the UI. Keep those phrases small and clear (1 to 4 words max).
2. The leftFraming and rightFraming texts MUST be fully written (no ellipsis placeholders like '...').
3. Refrain from using markdown tags inside 'storyText' or 'headline'.
4. Ensure the output is valid JSON. Do not return any other text besides the JSON code.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "category", "neutralSummary", "leftFraming", "rightFraming"],
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            neutralSummary: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            leftFraming: {
              type: Type.OBJECT,
              required: ["headline", "outletName", "storyText", "adjectives", "omittedFacts"],
              properties: {
                headline: { type: Type.STRING },
                outletName: { type: Type.STRING },
                storyText: { type: Type.STRING },
                adjectives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["phrase", "alternative", "explanation"],
                    properties: {
                      phrase: { type: Type.STRING },
                      alternative: { type: Type.STRING },
                      explanation: { type: Type.STRING }
                    }
                  }
                },
                omittedFacts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            },
            rightFraming: {
              type: Type.OBJECT,
              required: ["headline", "outletName", "storyText", "adjectives", "omittedFacts"],
              properties: {
                headline: { type: Type.STRING },
                outletName: { type: Type.STRING },
                storyText: { type: Type.STRING },
                adjectives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["phrase", "alternative", "explanation"],
                    properties: {
                      phrase: { type: Type.STRING },
                      alternative: { type: Type.STRING },
                      explanation: { type: Type.STRING }
                    }
                  }
                },
                omittedFacts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response output received from the model.");
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (error: any) {
    console.error("Analysis API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during bias analysis." });
  }
});

// Setup Vite Dev server or production static serving
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully live on port ${PORT}`);
  });
}

initializeServer();
