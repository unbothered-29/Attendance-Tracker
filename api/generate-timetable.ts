import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { profile } = req.body || {};
    if (!profile) {
      return res.status(400).json({ error: "No profile provided" });
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
        return res.status(500).json({ error: "Failed to parse AI output as JSON." });
      }
    }

    if (!Array.isArray(data.subjects)) data.subjects = [];
    if (!Array.isArray(data.slots)) data.slots = [];

    return res.status(200).json(data);
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
        error: "Invalid Gemini API Key. Please obtain a valid Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and set GEMINI_API_KEY in Vercel Project Settings." 
      });
    }
    return res.status(500).json({ error: errStr || "Failed to generate timetable" });
  }
}
