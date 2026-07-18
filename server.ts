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
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
Extract the timetable schedule from this image.
Return ONLY valid JSON matching this schema, without any markdown formatting or code blocks:
{
  "batches": ["B1", "B2"], // List of batch names if the timetable has batch-specific slots (e.g. practicals). Empty array if no batches.
  "subjects": [{"id": "sub_1", "name": "Subject Name", "teacher": "Teacher Name (if available)"}],
  "slots": [
    {
      "id": "slot_1",
      "subjectId": "sub_1",
      "start": "09:00",
      "end": "10:00",
      "dayOfWeek": 1, // 0=Sun, 1=Mon, 2=Tue, etc.
      "batch": "B1" // Include this ONLY if the slot is for a specific batch. Omit or set null if for all batches.
    }
  ]
}
Notes:
- Use 24-hour time format for start and end (e.g. 14:30). We will format it to 12-hour on the frontend.
- Group the same subject under the same subjectId, even for practicals. For example, "Physics" and "Physics (Practical)" should both use the exact same subjectId so their attendance is calculated together.
- Extract the teacher's name for each subject if visible.
- If a subject name is abbreviated, try to extract it as written.
- If times are not clearly visible, make your best guess based on the structure.
`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
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

      let responseText = response.text || "{}";
      
      // Clean up markdown block if present
      if (responseText.startsWith("```json")) {
        responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      const data = JSON.parse(responseText);
      res.json(data);
    } catch (error: any) {
      console.error("Error parsing timetable:", error);
      res.status(500).json({ error: error.message || "Failed to parse timetable" });
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
