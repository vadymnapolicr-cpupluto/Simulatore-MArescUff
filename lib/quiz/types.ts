export type SubjectId =
  | "logica"
  | "italiano"
  | "storia"
  | "civica"
  | "inglese"
  | "informatica"

export type Difficulty = "facile" | "difficile"

export type RolePrefix = "M" | "A" | "U" // M = Maresciallo, A = Allievo, U = Ufficiale

export interface Question {
  id: string
  /** Codice ufficiale/univoco del quesito (es. M05N67) */
  code?: string
  subject: SubjectId
  topic?: string
  difficulty: Difficulty
  text: string
  options: string[]
  correctIndex: number
  explanation?: string
  image?: string
  /** Simulation (PDF) this question was extracted from. */
  simulationId?: string
  /** ID del blocco di importazione per consentire l'eliminazione per ultima aggiunta */
  batchId?: string
  /** Original number in the PDF. */
  number?: number
  /** 1-based page in the PDF. */
  page?: number
  /** Vertical band of the question on the page, in PDF points (top > bottom). */
  band?: { top: number; bottom: number }
  /** Text references a figure/table but no image was found. */
  imageMissing?: boolean
  source?: "locale" | "ai" | "manuale"
  /** File name of the PDF the question was imported from. */
  sourcePdf?: string
  /** Name of the exam ("prova") given at import time. */
  sourceName?: string
  /** Edited by hand in the archive: re-imports won't overwrite it. */
  edited?: boolean
  updatedAt?: number
}

/** correctIndex = -1 means the solution is not known yet. */
export const isSolved = (q: Question) => q.correctIndex >= 0 && q.correctIndex < q.options.length

export interface Simulation {
  id: string
  name: string
  fileName: string
  role?: RolePrefix
  pdfIndex?: number
  pageCount: number
  createdAt: number
  method: "locale" | "ai"
  /** Shown as its own exam space (playable on its own) besides the general bank. */
  dedicated?: boolean
}

export interface AiSettings {
  apiKey: string
  model: string
  role: RolePrefix
  pdfNumber: number
  pagesPerChunk: number
  solveBlockSize: number
  delayMs: number
  maxRetries: number
  extractPrompt: string
  solvePrompt: string
}

export type QuestionOrder = "casuale" | "materia"
export type AnswerOrder = "casuale" | "ufficiale"
export type QuizMode = "esame" | "esercizio"
export type PoolFilter = "tutte" | "non-risposte" | "errate" | "dubbi"
export type DifficultyMode = "bilanciato" | "solo-facili" | "solo-difficili" | "personalizzato"
export type TimeMode = "ufficiale" | "personalizzato" | "per-domanda" | "illimitato"

export interface ScoringRules {
  correctEasy: number
  correctHard: number
  wrong: number
  blank: number
}

export interface QuizConfig {
  name: string
  official: boolean
  subjects: Record<SubjectId, number>
  difficultyMode: DifficultyMode
  hardPercent: number
  pool: PoolFilter
  timeMode: TimeMode
  totalMinutes: number
  secondsPerQuestion: number
  scoring: ScoringRules
  questionOrder: QuestionOrder
  answerOrder: AnswerOrder
  mode: QuizMode
  passThreshold: number
  /** When set, the session uses exactly these questions (e.g. a PDF simulation). */
  questionIds?: string[]
}

export interface SessionQuestion {
  questionId: string
  optionOrder: number[]
}

export interface AnswerState {
  selected: number | null
  candidates: number[]
  doubt: boolean
  timeSpentMs: number
}

export interface QuizSession {
  id: string
  config: QuizConfig
  questions: SessionQuestion[]
  startedAt: number
}

export interface AttemptQuestionResult {
  questionId: string
  subject: SubjectId
  difficulty: Difficulty
  selected: number | null
  correct: boolean
  doubt: boolean
  timeSpentMs: number
  points: number
}

export interface Attempt {
  id: string
  name: string
  official: boolean
  date: number
  durationMs: number
  score: number
  maxScore: number
  passThreshold: number
  correct: number
  wrong: number
  blank: number
  results: AttemptQuestionResult[]
}

export type QuestionStatus = "corretta" | "errata" | "saltata"

export interface QuestionProgress {
  status: QuestionStatus
  attempts: number
  correctCount: number
  doubt: boolean
  lastSeen: number
}