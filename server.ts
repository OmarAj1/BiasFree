import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for TL;DR
  app.post("/api/tldr", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        // Fallback for when API key is missing
        return res.json({ summary: "Gemini API key missing. Summary cannot be generated." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Summarize the following text in exactly one sentence: ${text.substring(0, 5000)}`
      });

      res.json({ summary: response.text });
    } catch (error: any) {
      console.error("TLDR Error:", error);
      res.status(500).json({ error: "Failed to generate summary", details: error.message });
    }
  });

  // API Route for Synonym/Neutral Term generator
  app.post("/api/neutralize", async (req, res) => {
    try {
      const { words } = req.body; // array of biased words
      if (!words || !Array.isArray(words)) {
        return res.status(400).json({ error: "Words array is required" });
      }
      
      const neutralMap: Record<string, string> = {};
      
      if (!process.env.GEMINI_API_KEY) {
        // Fast fallback if no key
        for (const word of words) {
           neutralMap[word] = "neutral term";
        }
        return res.json({ synonyms: neutralMap });
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `For the following list of politically biased or loaded words, provide exactly one neutral or objective synonym for each.
        Return ONLY valid JSON in the format { "word": "neutral synonym" }
        Words: ${words.join(', ')}`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      try {
        const result = JSON.parse(response.text || '{}');
        res.json({ synonyms: result });
      } catch (e) {
        console.error("Failed to parse Gemini Neutral JSON:", response.text);
        res.json({ synonyms: {} });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate synonyms", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
