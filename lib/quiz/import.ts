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
  const list = Array.isArray(data) ? data : (data as { questions?: unknown[] }).questions
  if (!Array.isArray(list)) return { questions: [], errors: ["Atteso un array di domande."] }
  const questions: Question[] = []
  const errors: string[] = []
  list.forEach((item, i) => {
    const o = item as Record<string, unknown>
    const subject = toSubject(o.subject ?? o.materia)
    const text = (o.text ?? o.domanda) as string | undefined
    const options = (o.options ?? o.risposte) as string[] | undefined
    const correct = o.correctIndex ?? o.corretta
    if (!subject) return errors.push(`#${i + 1}: materia mancante o non riconosciuta.`)
    if (!text || typeof text !== "string") return errors.push(`#${i + 1}: testo mancante.`)
    if (!Array.isArray(options) || options.length < 2) return errors.push(`#${i + 1}: servono almeno 2 risposte.`)
    let correctIndex = typeof correct === "number" ? correct : -1
    if (typeof correct === "string") {
      correctIndex = /^[A-Za-z]$/.test(correct) ? correct.toUpperCase().charCodeAt(0) - 65 : options.indexOf(correct)
    }
    if (correctIndex < 0 || correctIndex >= options.length) return errors.push(`#${i + 1}: risposta corretta non valida.`)
    questions.push({
      id: (o.id as string) ?? `imp-${hash(subject + text)}`,
      subject,
      difficulty: toDifficulty(o.difficulty ?? o.difficolta),
      topic: (o.topic ?? o.argomento) as string | undefined,
      text,
      options: options.map(String),
      correctIndex,
      explanation: (o.explanation ?? o.spiegazione) as string | undefined,
      image: o.image as string | undefined,
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
    })
  })
  return { questions, errors }
}

export const JSON_EXAMPLE = `[
  {
    "materia": "logica",
    "difficolta": "difficile",
    "argomento": "Serie numeriche",
    "domanda": "Completa: 1, 1, 2, 3, 5, ...",
    "risposte": ["7", "8", "9", "6"],
    "corretta": "B",
    "spiegazione": "Successione di Fibonacci."
  }
]`

export const TXT_EXAMPLE = `[storia][facile]
In che anno è caduto il Muro di Berlino?
1987
*1989
1991
1993
> Il Muro cadde il 9 novembre 1989.`
