import { generateText, Output } from "ai"
import { z } from "zod"
import { describeError, resolveModel } from "@/lib/ai/gemini"

export const maxDuration = 120

const bodySchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  currentQuestion: z.object({
    subject: z.enum(["logica", "italiano", "storia", "civica", "inglese", "informatica"]),
    difficulty: z.enum(["facile", "difficile"]),
    topic: z.string().optional(),
    text: z.string(),
    options: z.array(z.string()).default([]),
  }),
})

const questionSchema = z.object({
  domanda: z.string().describe("Testo chiaro, corretto e privo di errori della nuova domanda"),
  risposte: z.array(z.string()).length(4).describe("Quattro risposte coerenti A, B, C e D"),
  corretta: z.string().describe("Lettera corretta tra A, B, C o D"),
  argomento: z.string().describe("Argomento specifico di 2-4 parole"),
  spiegazione: z.string().describe("Spiegazione dettagliata e chiara del perché la risposta è corretta"),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Dati richiesta non validi.", raw: parsed.error.issues }, { status: 400 })
  }

  const { apiKey, model, currentQuestion } = parsed.data
  const resolved = resolveModel(apiKey, model)
  if (!resolved) {
    return Response.json({ error: "Inserisci la chiave Gemini nelle impostazioni." }, { status: 401 })
  }

  const prompt = `Sei un esperto preparatore per le prove scritte del concorso Guardia di Finanza.
Un quesito estratto da scansione o libretto risulta illeggibile, incompleto o formulato male:
- Materia: ${currentQuestion.subject}
- Difficoltà: ${currentQuestion.difficulty}
- Argomento iniziale: ${currentQuestion.topic || "attinente alla materia"}
- Testo attuale imperfetto: "${currentQuestion.text}"
- Risposte attuali: ${JSON.stringify(currentQuestion.options)}

IL TUO COMPITO:
Sostituisci questa domanda generando un quesito impeccabile, realistico e conforme allo stile ufficiale della Guardia di Finanza.
Mantieni ESATTAMENTE la stessa materia (${currentQuestion.subject}) e lo stesso livello di difficoltà (${currentQuestion.difficulty}).
Fornisci 4 opzioni di risposta chiare, la lettera corretta (A, B, C o D), un argomento conciso e la relativa spiegazione.`

  try {
    const result = await generateText({
      model: resolved.model,
      system: prompt,
      output: Output.object({ schema: questionSchema }),
      prompt: "Genera la domanda sostitutiva conforme.",
    })

    return Response.json({ question: result.output })
  } catch (error) {
    console.error("[ai/regenerate] error", error)
    const d = describeError(error)
    return Response.json({ error: d.error, raw: d.raw }, { status: d.status })
  }
}