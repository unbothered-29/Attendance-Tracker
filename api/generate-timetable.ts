import { GoogleGenAI } from "@google/genai";

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

    const ai = new GoogleGenAI({ apiKey });
    
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
      "dayOfWeek": 1
    }
  ]
}

Notes:
- Use 24-hour time format for start and end (e.g. 14:30).
- Group the same subject under the same subjectId.
- Provide a realistic 5-day schedule.`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [prompt],
      config: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
    });

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
      return res.status(500).json({ error: "Failed to parse AI output as JSON." });
    }
  } catch (error: any) {
    console.error("Error generating timetable:", error);
    return res.status(500).json({ error: error.message || "Failed to generate timetable" });
  }
}
