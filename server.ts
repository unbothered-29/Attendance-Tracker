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

      // Extract proper MIME type and clean base64 data
      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      if (imageBase64.includes(";base64,")) {
        const parts = imageBase64.split(";base64,");
        const prefix = parts[0];
        base64Data = parts[1];
        const mimeMatch = prefix.match(/data:(image\/[a-zA-Z0-9.+_-]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
      
      const prompt = `You are an expert OCR timetable parser. Extract all class schedules and subjects from this timetable image.

User's Profile Information (use to prioritize if multiple divisions/batches are listed):
- Field of Study: ${profile?.field || 'Engineering / General'}
- Current Semester: ${profile?.semester || '1'}
- Year of Study: ${profile?.year || 'FE'}
- Division: ${profile?.division || 'All / General'}
- Batch: ${profile?.batch || 'All / General'}

Extraction Rules:
1. Examine all grid cells, time headers, day rows/columns (Monday through Saturday/Sunday), and subject abbreviations/names.
2. If the image contains multiple division or batch sections, prioritize the one matching the user profile. If none specifically match or if it is a general class timetable, EXTRACT ALL classes visible on the schedule.
3. Extract clean subject names (expand standard acronyms if obvious, e.g. "DSA" -> "Data Structures & Algorithms", "M1" -> "Engineering Mathematics 1", or keep the name written). If a teacher or classroom is mentioned, put it in 'teacher'.
4. Ensure each subject has a unique id like "sub_1", "sub_2", etc.
5. Extract each slot with:
   - "id": unique string e.g. "slot_1", "slot_2"
   - "subjectId": matching the subject's id (e.g. "sub_1")
   - "start": 24-hour time "HH:MM" (e.g. "09:00", "10:30", "14:00")
   - "end": 24-hour time "HH:MM" (e.g. "10:00", "11:30", "15:00")
   - "dayOfWeek": integer where 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 0=Sunday.
6. Do NOT return an empty subject list if any timetable or class data is visible in the image.

Return ONLY valid JSON matching this schema:
{
  "subjects": [
    { "id": "sub_1", "name": "Subject Name", "teacher": "Teacher Name" }
  ],
  "slots": [
    { "id": "slot_1", "subjectId": "sub_1", "start": "09:00", "end": "10:00", "dayOfWeek": 1 }
  ]
}`;

      const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-pro"
      ];

      let response: any = null;
      let firstError: any = null;
      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: [
              prompt,
              {
                inlineData: {
                  data: base64Data,
                  mimeType
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
          if (!firstError) firstError = err;
          lastError = err;
          const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
          console.warn(`Model ${model} failed:`, errStr);

          if (
            errStr.includes("401") ||
            errStr.includes("UNAUTHENTICATED") ||
            errStr.includes("invalid authentication credentials") ||
            errStr.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
          ) {
            throw err;
          }
        }
      }

      if (!response) {
        throw firstError || lastError || new Error("Failed to parse timetable schedule with available models.");
      }

      let responseText = (response.text || "").trim();
      
      // Clean up markdown block if present
      if (responseText.startsWith("```json")) {
        responseText = responseText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      let data: any;
      try {
        data = JSON.parse(responseText.trim());
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to parse AI response into structured timetable format.");
        }
      }

      if (!Array.isArray(data.subjects)) data.subjects = [];
      if (!Array.isArray(data.slots)) data.slots = [];

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
- Year: ${profile.year || 'FE'}
- Division: ${profile.division || 'A'}
- Batch: ${profile.batch || 'B1'}
- Field: ${profile.field || 'Engineering'}
- Semester: ${profile.semester || '1'}

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
      "dayOfWeek": 1
    }
  ]
}

Notes:
- Use 24-hour time format for start and end (e.g. 14:30).
- Group the same subject under the same subjectId.
- Provide a realistic 5-day schedule.`;

      const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-pro"
      ];

      let response: any = null;
      let firstError: any = null;
      let lastError: any = null;

      for (const model of modelsToTry) {
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
          if (!firstError) firstError = err;
          lastError = err;
          const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
          console.warn(`Model ${model} failed:`, errStr);

          if (
            errStr.includes("401") ||
            errStr.includes("UNAUTHENTICATED") ||
            errStr.includes("invalid authentication credentials") ||
            errStr.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
          ) {
            throw err;
          }
        }
      }

      if (!response) {
        throw firstError || lastError || new Error("Failed to generate timetable with available models.");
      }

      let responseText = (response.text || "").trim();
      
      // Clean up markdown block if present
      if (responseText.startsWith("```json")) {
        responseText = responseText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      let data: any;
      try {
        data = JSON.parse(responseText.trim());
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Failed to parse AI response into structured timetable format.");
        }
      }

      if (!Array.isArray(data.subjects)) data.subjects = [];
      if (!Array.isArray(data.slots)) data.slots = [];

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
