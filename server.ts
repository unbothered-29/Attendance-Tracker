import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "50mb" }));

  app.post("/api/parse-timetable", async (req, res) => {
    try {
      const { imageBase64, profile } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const prompt = `Extract the timetable schedule from this image.
The user's profile is:
- Year: ${profile?.year || 'Any'}
- Division: ${profile?.division || 'Any'}
- Batch: ${profile?.batch || 'Any'}
- Field: ${profile?.field || 'Any'}
- Semester: ${profile?.semester || 'Any'}

Extract ONLY the subjects and slots that apply to this specific profile. Ignore classes for other divisions, batches, or years.

Return ONLY valid JSON matching this schema, without any markdown formatting or code blocks:
{
  "subjects": [{"id": "sub_1", "name": "Subject Name", "teacher": "Teacher Name (if available)"}],
  "slots": [
    {
      "id": "slot_1",
      "subjectId": "sub_1",
      "start": "09:00",
      "end": "10:00",
      "dayOfWeek": 1 // 0=Sun, 1=Mon, 2=Tue, etc.
    }
  ]
}

Notes:
- Use 24-hour time format for start and end (e.g. 14:30).
- Group the same subject under the same subjectId.`;

      const modelsToTry = [
        "gemini-3.6-flash",
        "gemini-2.5-flash",
        "gemini-3.6-pro",
        "gemini-2.5-pro"
      ];

      let response: any = null;
      let lastError: any = null;

      for (const model of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await ai.models.generateContent({
              model,
              contents: [
                prompt,
                {
                  inlineData: {
                    data: imageBase64.split(",")[1] || imageBase64,
                    mimeType: "image/jpeg"
                  }
                }
              ],
              config: {
                responseMimeType: "application/json",
                temperature: 0.1
              }
            });
            if (response) break;
          } catch (err: any) {
            lastError = err;
            const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
            const isTransient = errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand") || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED");
            if (!isTransient) throw err;
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
        if (response) break;
      }

      if (!response) {
        throw lastError || new Error("Failed after retries");
      }

      let responseText = response.text || "{}";
      
      // Clean up markdown block if present
      if (responseText.startsWith("\`\`\`json")) {
        responseText = responseText.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "");
      } else if (responseText.startsWith("\`\`\`")) {
        responseText = responseText.replace(/^\`\`\`\n/, "").replace(/\n\`\`\`$/, "");
      }

      const data = JSON.parse(responseText);
      res.json(data);
    } catch (error: any) {
      console.error("Error parsing timetable:", error);
      const errStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      if (
        errStr.includes("401") ||
        errStr.includes("UNAUTHENTICATED") ||
        errStr.includes("invalid authentication credentials") ||
        errStr.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
      ) {
        return res.status(401).json({ 
          error: "Invalid Gemini API Key. Please obtain a valid Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and set GEMINI_API_KEY in your environment." 
        });
      }
      res.status(500).json({ error: errStr || "Failed to parse timetable" });
    }
  });

  app.post("/api/generate-timetable", async (req, res) => {
    try {
      const { profile } = req.body;
      if (!profile) {
        return res.status(400).json({ error: "No profile provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const prompt = `Generate a realistic college timetable for a student with the following profile:
- Year: ${profile.year}
- Division: ${profile.division || 'A'}
- Batch: ${profile.batch || 'B1'}
- Field: ${profile.field}
- Semester: ${profile.semester}

Create a realistic weekly schedule (Monday to Friday, typically 9 AM to 4 PM, with appropriate gaps). Include 4-6 relevant subjects for this field and semester. Include a mix of lectures and practicals/labs if appropriate for the field.

Return ONLY valid JSON matching this schema, without any markdown formatting or code blocks:
{
  "subjects": [{"id": "sub_1", "name": "Subject Name", "teacher": "Teacher Name"}],
  "slots": [
    {
      "id": "slot_1",
      "subjectId": "sub_1",
      "start": "09:00",
      "end": "10:00",
      "dayOfWeek": 1 // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
    }
  ]
}

Notes:
- Use 24-hour time format for start and end (e.g. 14:30).
- Group the same subject under the same subjectId.
- Provide a realistic 5-day schedule.`;

      const modelsToTry = [
        "gemini-3.6-flash",
        "gemini-2.5-flash",
        "gemini-3.6-pro",
        "gemini-2.5-pro"
      ];

      let response: any = null;
      let lastError: any = null;

      for (const model of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await ai.models.generateContent({
              model,
              contents: [prompt],
              config: {
                responseMimeType: "application/json",
                temperature: 0.7
              }
            });
            if (response) break;
          } catch (err: any) {
            lastError = err;
            const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
            const isTransient = errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand") || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED");
            if (!isTransient) throw err;
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
        if (response) break;
      }

      if (!response) {
        throw lastError || new Error("Failed after retries");
      }

      let responseText = response.text || "{}";
      
      // Clean up markdown block if present
      if (responseText.startsWith("\`\`\`json")) {
        responseText = responseText.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "");
      } else if (responseText.startsWith("\`\`\`")) {
        responseText = responseText.replace(/^\`\`\`\n/, "").replace(/\n\`\`\`$/, "");
      }

      const data = JSON.parse(responseText);
      res.json(data);
    } catch (error: any) {
      console.error("Error generating timetable:", error);
      const errStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      if (
        errStr.includes("401") ||
        errStr.includes("UNAUTHENTICATED") ||
        errStr.includes("invalid authentication credentials") ||
        errStr.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
      ) {
        return res.status(401).json({ 
          error: "Invalid Gemini API Key. Please obtain a valid Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and set GEMINI_API_KEY in your environment." 
        });
      }
      res.status(500).json({ error: errStr || "Failed to generate timetable" });
    }
  });

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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
