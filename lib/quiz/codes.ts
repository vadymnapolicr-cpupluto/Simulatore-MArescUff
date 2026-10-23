import type { RolePrefix } from "./types"

export function formatQuestionCode(role: RolePrefix = "M", pdfNumber = 1, questionNumber = 1): string {
  const r: RolePrefix = role === "A" || role === "U" ? role : "M"
  const p = Math.max(1, Math.min(99, Math.floor(pdfNumber)))
  const q = Math.max(1, Math.floor(questionNumber))
  return `${r}${String(p).padStart(2, "0")}N${q}`
}

export function parseQuestionCode(code: string): { role: RolePrefix; pdfNumber: number; questionNumber: number } | null {
  const match = /^([MAU])(\d{2})N(\d+)$/i.exec(code.trim())
  if (!match) return null
  return {
    role: match[1].toUpperCase() as RolePrefix,
    pdfNumber: Number(match[2]),
    questionNumber: Number(match[3]),
  }
}

export function inferPdfNumber(name: string): number {
  const match = name.match(/(?:tipo|libretto|pdf|n\.?|vol\.?|p)?\s*0*([1-9]\d*)/i)
  if (match?.[1]) return Number(match[1])
  return 1
}