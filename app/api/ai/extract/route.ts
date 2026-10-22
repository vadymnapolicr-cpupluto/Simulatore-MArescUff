import { generateText, Output } from "ai"
import { z } from "zod"
import { describeError, resolveModel } from "@/lib/ai/gemini"
import { DEFAULT_EXTRACT_PROMPT } from "@/lib/quiz/prompts"

export const maxDuration = 300

const MAX_CHUNK_BYTES = 4 * 1024 * 1024

const schema = z.object({
  questions: z.array(
    z.object({
      numero: z.number().describe("Numero originale della domanda nel libretto"),
      pagina: z.number().describe("Pagina dentro il blocco ricevuto, 1 = prima"),
      domanda: z.string(),
      risposte: z.array(z.string()).min(2),
      corretta: z.string().describe("Lettera A, B, C o D"),
      materia: z.enum(["logica", "italiano", "storia", "civica", "inglese", "informatica"]),
      difficolta: z.enum(["facile", "difficile"]),
      figura: z.array(z.number()).nullable().describe("[ymin, xmin, ymax, xmax] 0-1000 oppure null"),
    }),
  ),
})

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get("file")
  const fromPage = Number(form.get("fromPage"))
  const toPage = Number(form.get("toPage"))

  if (!(file instanceof File)) return Response.json({ error: "File PDF mancante." }, { status: 400 })
  if (file.size > MAX_CHUNK_BYTES) {
    return Response.json(
      { error: "Blocco troppo grande (max 4 MB): riduci le pagine per blocco.", raw: { size: file.size } },
      { status: 413 },
    )
  }

  const resolved = resolveModel(form.get("apiKey"), form.get("model"))
  if (!resolved) return Response.json({ error: "Inserisci la chiave Gemini nelle impostazioni." }, { status: 401 })

  const prompt = String(form.get("prompt") ?? "").trim() || DEFAULT_EXTRACT_PROMPT
  const started = Date.now()

  try {
    const result = await generateText({
      model: resolved.model,
      system: prompt,
      maxRetries: 0,
      output: Output.object({ schema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Pagine ${fromPage}-${toPage} del libretto. Estrai le domande in JSON.` },
            { type: "file", mediaType: "application/pdf", data: new Uint8Array(await file.arrayBuffer()) },
          ],
        },
      ],
    })
    return Response.json({
      questions: result.output.questions,
      meta: { model: resolved.id, ms: Date.now() - started, usage: result.usage, finishReason: result.finishReason },
    })
  } catch (error) {
    console.error("[ai/extract] error", error)
    const d = describeError(error)
    return Response.json(
      { error: d.error, raw: d.raw, retryAfterSec: d.retryAfterSec, model: resolved.id },
      { status: d.status },
    )
  }
}
