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
    throw new Error(data.error || `Server error (${res.status})`);
  }

  return data;
}
