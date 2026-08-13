import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { imageBase64, profile } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY is not configured on Vercel. Please add GEMINI_API_KEY under Vercel Project Settings -> Environment Variables and redeploy." 
      });
    }

    const ai = new GoogleGenAI({ 
      apiKey,
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
      "dayOfWeek": 1
    }
  ]
}

Notes:
- Use 24-hour time format for start and end (e.g. 14:30).
- Group the same subject under the same subjectId.`;

    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.1-pro"
    ];

    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
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
        console.warn(`Model ${model} failed:`, errStr);

        if (
          errStr.includes("401") ||
          errStr.includes("UNAUTHENTICATED") ||
          errStr.includes("invalid authentication credentials")
        ) {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed after retries");
    }

    let responseText = response.text || "{}";
    
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const data = JSON.parse(responseText.trim());
      return res.status(200).json(data);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI output. Please try again with a clearer image." });
    }
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
        error: "Invalid Gemini API Key. Please obtain a valid Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and set GEMINI_API_KEY in Vercel Project Settings." 
      });
    }
    return res.status(500).json({ error: errStr || "Failed to parse timetable" });
  }
}
