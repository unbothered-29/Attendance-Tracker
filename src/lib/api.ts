export async function safeFetchApi(url: string, body: any) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err: any) {
    throw new Error(`Network error: ${err.message || "Failed to connect to server"}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  let data: any = null;
  if (contentType.includes("application/json") || rawText.trim().startsWith("{") || rawText.trim().startsWith("[")) {
    try {
      data = JSON.parse(rawText.trim());
    } catch {
      console.error("Failed to parse JSON response:", rawText);
    }
  }

  if (!data) {
    if (res.status === 404 || rawText.includes("The page") || rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
      throw new Error(
        "Backend API not reached (404/HTML error page). Please ensure GEMINI_API_KEY is configured in Vercel Project Settings -> Environment Variables and redeploy."
      );
    }
    throw new Error(`Server returned non-JSON response (${res.status}): ${rawText.slice(0, 100)}`);
  }

  if (!res.ok) {
    let errMsg = "Server error";
    if (typeof data.error === "string") {
      errMsg = data.error;
    } else if (data.error && typeof data.error === "object") {
      errMsg = data.error.message || JSON.stringify(data.error);
    } else if (data.message) {
      errMsg = data.message;
    }

    if (
      errMsg.includes("401") ||
      errMsg.includes("UNAUTHENTICATED") ||
      errMsg.includes("invalid authentication credentials") ||
      errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
    ) {
      errMsg = "Invalid Gemini API Key. Your GEMINI_API_KEY is missing or invalid. Please get a free API key from Google AI Studio (https://aistudio.google.com/app/apikey) and set GEMINI_API_KEY in Vercel Project Settings -> Environment Variables.";
    }

    throw new Error(errMsg);
  }

  return data;
}
