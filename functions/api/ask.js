// Cloudflare Pages Function — served at /api/ask
// Answers forecast questions using one of several providers, chosen by the
// AI_PROVIDER env var (or inferred). No key is ever exposed to the browser.
//   providers: "workers-ai" (keyless binding) | "gemini" (GEMINI_API_KEY) | "anthropic" (ANTHROPIC_API_KEY)

const WORKERS_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
const GEMINI_MODEL = "gemini-3.6-flash"; // current free-tier Flash model on Google AI Studio

const SYSTEM_PROMPT = `You are a concise weather assistant embedded in a weather app called Skyline.
You are given the current forecast for one location as JSON, and a user question.
Answer ONLY using the data provided — never invent numbers, locations, or dates.
If the question needs a date/time outside the provided current/next_24h/next_7_days data, say plainly that it's outside the available forecast window rather than guessing.
Keep answers short: 1-3 sentences, plain everyday language, no headers or bullet lists, no repeating the raw numbers back verbatim unless the question asks for a specific figure.
Temperatures in the data are already in the user's chosen unit — do not re-convert them.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { question, context: forecastContext } = body || {};
  if (!question || typeof question !== "string" || question.length > 500) {
    return json({ error: "Missing or invalid question." }, 400);
  }
  if (!forecastContext || typeof forecastContext !== "object") {
    return json({ error: "Missing forecast context." }, 400);
  }

  const prompt = `Forecast data (JSON):\n${JSON.stringify(forecastContext)}\n\nQuestion: ${question}`;

  const provider = env.AI_PROVIDER
    || (env.AI ? "workers-ai"
      : env.GEMINI_API_KEY ? "gemini"
        : env.ANTHROPIC_API_KEY ? "anthropic" : null);

  switch (provider) {
    case "workers-ai":
      if (!env.AI) break;
      return answerViaWorkersAI(env.AI, prompt);
    case "gemini":
      if (!env.GEMINI_API_KEY) break;
      return answerViaGemini(env, prompt);
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) break;
      return answerViaAnthropic(env.ANTHROPIC_API_KEY, prompt);
  }

  return json({
    error: "The assistant isn't configured — set AI_PROVIDER plus its key/binding (workers-ai, gemini, or anthropic).",
  }, 500);
}

async function answerViaGemini(env, prompt) {
  const model = env.GEMINI_MODEL || GEMINI_MODEL;
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Gemini API error", upstream.status, errText);
      if (upstream.status === 429) {
        return json({ error: "Rate-limited by the free Gemini tier — try again in a minute." }, 502);
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return json({ error: "Gemini rejected the API key — check GEMINI_API_KEY." }, 502);
      }
      return json({ error: "The assistant is temporarily unavailable." }, 502);
    }

    const data = await upstream.json();
    const answer = data?.choices?.[0]?.message?.content?.trim()
      || "I couldn't come up with an answer from the current forecast.";
    return json({ answer, provider: "gemini", model });
  } catch (err) {
    console.error("Gemini error", err);
    return json({ error: "Something went wrong reaching the assistant." }, 500);
  }
}

async function answerViaWorkersAI(ai, prompt) {
  try {
    const out = await ai.run(WORKERS_MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 250,
    });
    const answer = out && typeof out.response === "string"
      ? out.response.trim()
      : "I couldn't come up with an answer from the current forecast.";
    return json({ answer, provider: "workers-ai", model: WORKERS_MODEL });
  } catch (err) {
    console.error("Workers AI error", err);
    const msg = String(err && err.message || err).toLowerCase();
    if (/limit|quota|free|neurons|allocation/.test(msg)) {
      return json({ error: "The free AI allowance ran out for today — it resets at midnight UTC, or chat can be enabled on the paid plan." }, 502);
    }
    return json({ error: "The assistant is temporarily unavailable." }, 502);
  }
}

async function answerViaAnthropic(apiKey, prompt) {
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Anthropic API error", upstream.status, errText);
      const detail = errText.toLowerCase();
      if (/credit balance|insufficient|billing|payment/.test(detail)) {
        return json({ error: "The AI assistant's account is out of credits — top it up in the Anthropic console, then try again." }, 502);
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return json({ error: "The AI assistant rejected the API key — check ANTHROPIC_API_KEY." }, 502);
      }
      if (upstream.status === 429) {
        return json({ error: "The AI assistant is rate-limited right now — try again in a moment." }, 502);
      }
      return json({ error: "The assistant is temporarily unavailable." }, 502);
    }

    const data = await upstream.json();
    const answer = (data.content || []).find((b) => b.type === "text")?.text?.trim()
      || "I couldn't come up with an answer from the current forecast.";

    return json({ answer, provider: "anthropic" });
  } catch (err) {
    console.error("ask.js error", err);
    return json({ error: "Something went wrong reaching the assistant." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
