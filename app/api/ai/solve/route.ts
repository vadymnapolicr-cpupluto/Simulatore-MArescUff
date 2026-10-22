import { generateText, Output, type UserContent } from "ai"
import { z } from "zod"
import { describeError, resolveModel } from "@/lib/ai/gemini"
import { DEFAULT_SOLVE_PROMPT } from "@/lib/quiz/prompts"

export const maxDuration = 300

const bodySchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        options: z.array(z.string()).min(2).max(6),
        image: z.string().startsWith("data:image/").optional(),
      }),
    )
    .min(1)
    .max(40),
})

const outSchema = z.object({
  solutions: z.array(
    z.object({
      id: z.string(),
      corretta: z.string().describe("Lettera A, B, C o D"),
      materia: z.enum(["logica", "italiano", "storia", "civica", "inglese", "informatica"]),
      difficolta: z.enum(["facile", "difficile"]),
      argomento: z.string(),
      spiegazione: z.string(),
    }),
  ),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Richiesta non valida.", raw: parsed.error.issues }, { status: 400 })
  }
  const { apiKey, model, prompt, questions } = parsed.data
  const resolved = resolveModel(apiKey, model)
  if (!resolved) return Response.json({ error: "Inserisci la chiave Gemini nelle impostazioni." }, { status: 401 })

  const content: UserContent = [
    { type: "text", text: "Risolvi queste domande. Restituisci una soluzione per ogni id." },
  ]
  for (const q of questions) {
    const letters = q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")
    content.push({ type: "text", text: `\n[id: ${q.id}]\n${q.text}\n${letters}${q.image ? "\n(figura allegata sotto)" : ""}` })
    if (q.image) content.push({ type: "image", image: q.image })
  }

  const started = Date.now()
  try {
    const result = await generateText({
      model: resolved.model,
      system: prompt?.trim() || DEFAULT_SOLVE_PROMPT,
      maxRetries: 0,
      output: Output.object({ schema: outSchema }),
      messages: [{ role: "user", content }],
    })
    return Response.json({
      solutions: result.output.solutions,
      meta: { model: resolved.id, ms: Date.now() - started, usage: result.usage, finishReason: result.finishReason },
    })
  } catch (error) {
    console.error("[ai/solve] error", error)
    const d = describeError(error)
    return Response.json(
      { error: d.error, raw: d.raw, retryAfterSec: d.retryAfterSec, model: resolved.id },
      { status: d.status },
    )
  }
}
