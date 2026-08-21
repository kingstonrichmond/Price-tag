// Price Tag — API proxy. Keeps the Anthropic key on the server, never in the page.
// Required Netlify env var: ANTHROPIC_API_KEY
// Optional Netlify env var: APP_CODE   (if set, the app asks for it once per phone)

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: { message: "POST only." } }) };
  }

  const appCode = process.env.APP_CODE;
  if (appCode) {
    const headers = event.headers || {};
    const sent = headers["x-app-code"] || headers["X-App-Code"];
    if (!sent || sent.trim() !== appCode.trim()) {
      return { statusCode: 401, body: JSON.stringify({ error: { message: "Wrong passcode." } }) };
    }
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: "ANTHROPIC_API_KEY isn't set in Netlify." } })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: "Bad request body." } }) };
  }

  const body = {
    model: payload.model || "claude-sonnet-4-6",
    max_tokens: payload.max_tokens || 2000,
    system: payload.system,
    messages: payload.messages || []
  };
  if (payload.tools) body.tools = payload.tools;

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 55000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: text
    };
  } catch (e) {
    const timedOut = e && e.name === "AbortError";
    return {
      statusCode: timedOut ? 504 : 502,
      body: JSON.stringify({
        error: { message: timedOut ? "The search took too long. Try again." : "Couldn't reach the pricing service." }
      })
    };
  } finally {
    clearTimeout(timer);
  }
};
