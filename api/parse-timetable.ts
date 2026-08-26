import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

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
    
    const prompt = `You are a high-precision Timetable Image Validator & OCR Schedule Parser.

STEP 1: IMAGE VALIDATION (CRITICAL)
First, verify whether the provided image is a genuine academic/school/college timetable, class routine, or lecture schedule grid.
- If the uploaded image is NOT a timetable (for example: a photo of a person/selfie, an animal, vehicle, scenery, landscape, food item, receipt, invoice, random object, textbook text without a weekly schedule grid, meme, screenshot of unrelated apps/games, or completely unreadable blur):
  You MUST IMMEDIATELY return:
  {
    "isTimetable": false,
    "error": "Invalid photo: The uploaded image is not a timetable or class schedule. Please upload a clear photo of your timetable."
  }

STEP 2: IF THE IMAGE IS A VALID TIMETABLE:
USER PROFILE DETAILS (Use to narrow down if the timetable has multiple division or batch columns):
- Field of Study: ${profile?.field || 'General'}
- Semester: ${profile?.semester || '1'}
- Year: ${profile?.year || 'FE'}
- Division: ${profile?.division || 'General'}
- Batch: ${profile?.batch || 'General'}

STRICT OCR INSTRUCTIONS:
1. Examine the grid layout: Identify the Day headers (e.g. Mon, Tue, Wed, Thu, Fri, Sat) and Time slot headers (e.g. 08:30-09:30, 09:30-10:30, 11:00-12:00, 1:00-2:00, etc.).
2. Read the text inside EVERY cell for each day and time slot.
3. DO NOT invent fake, random, or generic subjects (like "Engineering Mathematics" or "Data Structures" unless that is literally what is written in the image). Extract the exact subject name, acronym, or course code written in the image (e.g., "CHEM", "PHY", "MATHS-II", "CS-101", "BEE", "EM", "LAB A1", etc.).
4. If a teacher's name or room/lab number is written in the cell (e.g., "Dr. Smith", "Room 302", "Lab 4"), include it in the 'teacher' field.
5. In the "subjects" array, create an entry for every unique subject found on the schedule with:
   - "id": a unique string like "sub_1", "sub_2", "sub_3", etc.
   - "name": the subject name as written in the timetable
   - "teacher": teacher name/room if mentioned (optional string)
6. In the "slots" array, create an entry for every class/period scheduled across the week:
   - "id": unique string (e.g., "slot_1", "slot_2", ...)
   - "subjectId": the "id" of the matching subject from the "subjects" array
   - "dayOfWeek": integer representing the day (1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 0 = Sunday)
   - "start": start time in 24-hour format "HH:MM" (e.g., "09:00", "10:30", "14:15")
   - "end": end time in 24-hour format "HH:MM" (e.g., "10:00", "11:30", "15:15")

Format your response strictly as JSON with this exact structure:
{
  "isTimetable": true,
  "subjects": [
    { "id": "sub_1", "name": "Exact Subject Name", "teacher": "Teacher/Room (optional)" }
  ],
  "slots": [
    { "id": "slot_1", "subjectId": "sub_1", "dayOfWeek": 1, "start": "09:00", "end": "10:00" }
  ]
}`;

    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-2.5-flash",
      "gemini-flash-latest"
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
        return res.status(500).json({ error: "Failed to parse AI output. Please try again with a clearer image." });
      }
    }

    if (
      data.isTimetable === false || 
      (Array.isArray(data.subjects) && data.subjects.length === 0 && (!data.slots || data.slots.length === 0))
    ) {
      return res.status(400).json({
        error: data.error || "Invalid photo: The uploaded image is not a timetable. Please upload a clear photo of your class schedule."
      });
    }

    if (!Array.isArray(data.subjects)) data.subjects = [];
    if (!Array.isArray(data.slots)) data.slots = [];

    return res.status(200).json(data);
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
