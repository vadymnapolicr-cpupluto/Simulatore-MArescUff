import { createGoogleGenerativeAI } from "@ai-sdk/google"

export function resolveModel(apiKey: unknown, model: unknown) {
  const key = String(apiKey ?? "").trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const id = String(model ?? "").trim() || "gemini-flash-latest"
  if (!key) return null
  return { model: createGoogleGenerativeAI({ apiKey: key })(id), id }
}

function collect(error: unknown, depth = 0): Record<string, unknown> {
  if (!error || typeof error !== "object" || depth > 3) return { value: String(error) }
  const e = error as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of [
    "name",
    "message",
    "statusCode",
    "url",
    "isRetryable",
    "responseHeaders",
    "responseBody",
    "usage",
    "response",
    "data",
    "finishReason",
    "text",
    "reason",
    "lastError",
    "errors",
  ]) {
    const v = e[k]
    if (v === undefined) continue
    if (k === "responseBody" && typeof v === "string") {
      try {
        out[k] = JSON.parse(v)
      } catch {
        out[k] = v
      }
    } else if (k === "lastError" || k === "errors") {
      out[k] = Array.isArray(v) ? v.map((x) => collect(x, depth + 1)) : collect(v, depth + 1)
    } else out[k] = v
  }
  if (e.cause) out.cause = collect(e.cause, depth + 1)
  if (depth === 0 && typeof e.stack === "string") out.stack = e.stack
  return out
}

export function describeError(error: unknown) {
  const raw = collect(error)
  const blob = JSON.stringify(raw)
  const status = Number(
    (raw.statusCode as number) ??
      ((raw.lastError as Record<string, unknown> | undefined)?.statusCode as number) ??
      0,
  )
  const retry = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(blob)
  const retryAfterSec = retry ? Math.ceil(Number(retry[1])) : undefined

  let message = "Richiesta a Gemini non riuscita. Espandi il dettaglio per la risposta grezza."
  if (/API_KEY_INVALID|api key not valid/i.test(blob)) message = "Chiave Gemini non valida."
  else if (/PERMISSION_DENIED|403/.test(blob)) message = "Permesso negato dalla chiave/progetto Gemini."
  else if (/not found|is not supported for generateContent|404/i.test(blob)) message = "Modello non trovato: cambia modello nelle impostazioni."
  else if (/PerDay|per day|daily/i.test(blob)) message = "Quota GIORNALIERA del modello esaurita per questa chiave (riprova domani o cambia modello)."
  else if (/RESOURCE_EXHAUSTED|429|quota|rate/i.test(blob))
    message = `Limite di richieste al minuto raggiunto${retryAfterSec ? `, riprova tra ${retryAfterSec}s` : ""}.`
  else if (/UNAVAILABLE|overloaded|503/i.test(blob)) message = "Modello sovraccarico (503), riprova."
  else if (/SAFETY|RECITATION|blocked/i.test(blob)) message = "Risposta bloccata dai filtri di Gemini."
  else if (/No object generated|could not parse|JSON/i.test(blob)) message = "Gemini ha risposto con JSON non valido o troncato."
  else if (/timeout|aborted/i.test(blob)) message = "Timeout della richiesta."

  return { error: message, raw, status: status || 502, retryAfterSec }
}
