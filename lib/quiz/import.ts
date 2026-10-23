import { SUBJECTS } from "./subjects"
import type { Difficulty, Question, SubjectId } from "./types"

const SUBJECT_ALIASES: Record<string, SubjectId> = {
  logica: "logica",
  matematica: "logica",
  "logico-matematica": "logica",
  italiano: "italiano",
  lingua: "italiano",
  storia: "storia",
  civica: "civica",
  "educazione civica": "civica",
  inglese: "inglese",
  english: "inglese",
  informatica: "informatica",
}

function toSubject(raw: unknown): SubjectId | null {
  if (typeof raw !== "string") return null
  const key = raw.trim().toLowerCase()
  if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key]
  const match = SUBJECTS.find((s) => s.id === key || s.label.toLowerCase() === key)
  return match?.id ?? null
}

function toDifficulty(raw: unknown): Difficulty {
  if (typeof raw === "string" && /diff|hard|3/i.test(raw)) return "difficile"
  if (raw === 3) return "difficile"
  return "facile"
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

export interface ImportResult {
  questions: Question[]
  errors: string[]
}

export function parseQuestions(input: string): ImportResult {
  const trimmed = input.trim()
  if (!trimmed) return { questions: [], errors: ["Nessun contenuto da importare."] }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseJson(trimmed)
  return parseText(trimmed)
}

function parseJson(input: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(input)
  } catch {
    return { questions: [], errors: ["JSON non valido."] }
  }

  let list: unknown[] | undefined
  if (Array.isArray(data)) {
    list = data
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.questions)) list = obj.questions
    else if (Array.isArray(obj.domande)) list = obj.domande
    else if (Array.isArray(obj.data)) list = obj.data
  }

  if (!Array.isArray(list)) return { questions: [], errors: ["Atteso un array o un oggetto con lista 'questions'."] }

  const questions: Question[] = []
  const errors: string[] = []
  const currentBatchId = `batch-import-${Date.now()}`

  list.forEach((item, i) => {
    if (!item || typeof item !== "object") {
      errors.push(`#${i + 1}: elemento non valido.`)
      return
    }
    const o = item as Record<string, unknown>
    const subject = toSubject(o.subject ?? o.materia)
    const text = ((o.text ?? o.domanda) as string | undefined)?.trim()
    const rawOptions = (o.options ?? o.risposte) as unknown[] | undefined

    if (!subject) {
      errors.push(`#${i + 1}: materia mancante o non riconosciuta.`)
      return
    }
    if (!text) {
      errors.push(`#${i + 1}: testo della domanda mancante.`)
      return
    }
    if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
      errors.push(`#${i + 1}: servono almeno 2 risposte.`)
      return
    }

    const options = rawOptions.map(String).map((s) => s.trim())
    const correct = o.correctIndex ?? o.corretta ?? o.correctLetter

    let correctIndex = -1
    if (typeof correct === "number") {
      correctIndex = correct >= 0 && correct < options.length ? correct : -1
    } else if (typeof correct === "string" && correct.trim()) {
      const c = correct.trim().toUpperCase()
      if (/^[A-Z]$/.test(c)) {
        const idx = c.charCodeAt(0) - 65
        correctIndex = idx >= 0 && idx < options.length ? idx : -1
      } else {
        correctIndex = options.indexOf(correct.trim())
      }
    }

    const code = ((o.code ?? o.codice) as string | undefined)?.trim().toUpperCase()
    const id = (o.id as string | undefined)?.trim() || (code ? `q-${code.toLowerCase()}` : `imp-${hash(subject + text)}`)
    const num = typeof o.number === "number" ? o.number : typeof o.numero === "number" ? o.numero : undefined
    const page = typeof o.page === "number" ? o.page : typeof o.pagina === "number" ? o.pagina : undefined

    questions.push({
      id,
      code: code || undefined,
      subject,
      difficulty: toDifficulty(o.difficulty ?? o.difficolta),
      topic: ((o.topic ?? o.argomento) as string | undefined)?.trim() || undefined,
      text,
      options,
      correctIndex,
      explanation: ((o.explanation ?? o.spiegazione) as string | undefined)?.trim() || undefined,
      image: ((o.image ?? o.immagine) as string | undefined) || undefined,
      number: num,
      page,
      sourcePdf: ((o.sourcePdf ?? o.pdf) as string | undefined)?.trim() || undefined,
      sourceName: ((o.sourceName ?? o.prova) as string | undefined)?.trim() || undefined,
      batchId: (o.batchId as string | undefined)?.trim() || currentBatchId,
      source: "manuale",
      updatedAt: Date.now(),
    })
  })

  return { questions, errors }
}

function parseText(input: string): ImportResult {
  const blocks = input.split(/\n\s*\n/)
  const questions: Question[] = []
  const errors: string[] = []
  blocks.forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
    const header = lines[0]?.match(/^\[(.+?)\]\s*\[(.+?)\]$/)
    if (!header) return errors.push(`Blocco ${i + 1}: intestazione [materia][difficoltà] mancante.`)
    const subject = toSubject(header[1])
    if (!subject) return errors.push(`Blocco ${i + 1}: materia non riconosciuta.`)
    const text = lines[1]
    const optionLines = lines.slice(2).filter((l) => !l.startsWith(">"))
    const explanation = lines.find((l) => l.startsWith(">"))?.slice(1).trim()
    const correctIndex = optionLines.findIndex((l) => l.startsWith("*"))
    if (!text || optionLines.length < 2 || correctIndex < 0)
      return errors.push(`Blocco ${i + 1}: servono domanda, risposte e una risposta con *.`)
    questions.push({
      id: `imp-${hash(subject + text)}`,
      subject,
      difficulty: toDifficulty(header[2]),
      text,
      options: optionLines.map((l) => l.replace(/^\*\s*/, "")),
      correctIndex,
      explanation,
      batchId: `batch-import-${Date.now()}`,
      updatedAt: Date.now(),
    })
  })
  return { questions, errors }
}

export const JSON_EXAMPLE = `{
  "app": "Simulatore GdF",
  "questions": [
    {
      "codice": "M05N01",
      "materia": "logica",
      "difficolta": "difficile",
      "argomento": "Serie numeriche",
      "domanda": "Completa la serie: 1, 1, 2, 3, 5, ...",
      "risposte": ["7", "8", "9", "6"],
      "corretta": "B",
      "spiegazione": "Successione di Fibonacci."
    }
  ]
}`

export const TXT_EXAMPLE = `[storia][facile]
In che anno è caduto il Muro di Berlino?
1987
*1989
1991
1993
> Il Muro cadde il 9 novembre 1989.`