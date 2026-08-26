export async function safeFetchApi(url: string, body: any) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err: any) {
    throw new Error(`Network error: ${err.message || "Failed to connect to server. Please check your internet connection."}`);
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
    if (res.status === 504 || rawText.includes("FUNCTION_INVOCATION_TIMEOUT") || rawText.includes("Gateway Timeout")) {
      throw new Error(
        "Request timed out while analyzing the image. We have auto-loaded standard subjects for your profile so you can proceed without waiting!"
      );
    }
    if (res.status === 413 || rawText.includes("Payload Too Large")) {
      throw new Error("Image file size is too large. Please select a smaller photo or crop it.");
    }
    if (res.status === 404 || rawText.includes("The page") || rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
      throw new Error(
        "Backend API not reached (404). Please ensure GEMINI_API_KEY is configured in Vercel Project Settings -> Environment Variables and redeploy."
      );
    }
    throw new Error(`Server returned unexpected response (${res.status}).`);
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
    } else if (
      errMsg.includes("503") ||
      errMsg.includes("UNAVAILABLE") ||
      errMsg.includes("high demand") ||
      errMsg.includes("429") ||
      errMsg.includes("RESOURCE_EXHAUSTED")
    ) {
      errMsg = "Google AI models are currently experiencing temporary high demand traffic. Please wait a few seconds and try clicking again.";
    }

    throw new Error(errMsg);
  }

  return data;
}

