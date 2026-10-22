import type { SubjectId } from "./types"

const RULES: [SubjectId, RegExp][] = [
  [
    "informatica",
    /\b(computer|hardware|software|file|excel|word|cpu|processore|bit|byte|ram|tastiera|mouse|sistema operativo|browser|editor|cartell[ae]|batch|script|rete|internet|email|password|foglio di calcolo|cella|database|server|backup|router|usb|pdf|windows|linux)\b/i,
  ],
  [
    "civica",
    /\b(costituzion\w*|repubblica|parlamento|senat\w*|camera dei deputati|presidente|governo|ministr\w*|garante|legge|decreto|diritt\w*|stato membro|unione europea|commissione europea|consiglio europeo|agenda 2030|sviluppo sostenibile|onu|corte|tribunale|giudic\w*|magistratura|regioni a statuto|referendum|cittadin\w*|dati personali|privacy|gdpr)\b/i,
  ],
  [
    "storia",
    /\b(battaglia|guerra|impero|regno|re |regina|secolo|rivoluzion\w*|fascis\w*|risorgimento|unità d'italia|storic\w*|fu (assassinat|fondat|creat|eletto)|in che anno|dinastia|trattato|armistizio|resistenza|medioevo|napoleon\w*|garibaldi|mussolini|cavour)\b/i,
  ],
  [
    "logica",
    /(\d\s*[+\-*/:=x^]\s*\d|\bserie\b|successivo|tabella|figura|probabilit\w*|percentual\w*|media|equazion\w*|sta a|numer\w* (pari|dispari|primi)|insieme|stringh\w*|dadi|cubo|triangol\w*|quadrat\w*|cerchi\w*|area|perimetro|velocit\w*|km|€|euro)/i,
  ],
  [
    "italiano",
    /\b(sinonim\w*|contrari\w*|aggettiv\w*|verb\w*|sostantiv\w*|pronom\w*|frase|predicato|soggetto|complemento|ortografic\w*|grammatic\w*|passato remoto|congiuntivo|plurale|singolare|sintagm\w*|significato|termine|parola|proposizion\w*|analisi)\b/i,
  ],
]

const ENGLISH_RE = /\b(the|which|what|is|are|sentence|word|complete|following|of|and|to|she|he|they|correct|best)\b/gi

export function guessSubject(text: string, options: string[] = []): SubjectId | null {
  const all = `${text} ${options.join(" ")}`
  const englishHits = all.match(ENGLISH_RE)?.length ?? 0
  if (englishHits >= 4 && englishHits / all.split(/\s+/).length > 0.12) return "inglese"
  const scores = RULES.map(([id, re]) => {
    const g = new RegExp(re.source, "gi")
    return { id, score: all.match(g)?.length ?? 0 }
  }).sort((a, b) => b.score - a.score)
  return scores[0].score > 0 ? scores[0].id : null
}

/**
 * Libretti group questions by subject, so smooth each guess with its neighbours
 * (window of 5) to fix isolated misclassifications.
 */
export function classifySequence(items: { text: string; options: string[] }[]): SubjectId[] {
  const raw = items.map((q) => guessSubject(q.text, q.options))
  return raw.map((g, i) => {
    const counts = new Map<SubjectId, number>()
    for (let k = Math.max(0, i - 2); k <= Math.min(raw.length - 1, i + 2); k++) {
      const s = raw[k]
      if (s) counts.set(s, (counts.get(s) ?? 0) + (k === i ? 1.5 : 1))
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    return best?.[0] ?? g ?? "logica"
  })
}
