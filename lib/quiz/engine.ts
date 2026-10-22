import { SUBJECTS } from "./subjects"
import type {
  AnswerState,
  Attempt,
  AttemptQuestionResult,
  Difficulty,
  PoolFilter,
  Question,
  QuestionProgress,
  QuizConfig,
  QuizSession,
  SubjectId,
} from "./types"

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function matchesPool(q: Question, pool: PoolFilter, progress: Record<string, QuestionProgress>) {
  const p = progress[q.id]
  switch (pool) {
    case "tutte":
      return true
    case "non-risposte":
      return !p
    case "errate":
      return !!p && (p.status === "errata" || p.status === "saltata")
    case "dubbi":
      return !!p && p.doubt
  }
}

export function availability(
  bank: Question[],
  pool: PoolFilter,
  progress: Record<string, QuestionProgress>,
) {
  const result = {} as Record<SubjectId, Record<Difficulty, number>>
  for (const s of SUBJECTS) result[s.id] = { facile: 0, difficile: 0 }
  for (const q of bank) {
    if (matchesPool(q, pool, progress)) result[q.subject][q.difficulty]++
  }
  return result
}

export function targetHardPercent(config: QuizConfig) {
  switch (config.difficultyMode) {
    case "bilanciato":
      return 50
    case "solo-facili":
      return 0
    case "solo-difficili":
      return 100
    case "personalizzato":
      return config.hardPercent
  }
}

export function totalQuestions(config: QuizConfig) {
  return Object.values(config.subjects).reduce((a, b) => a + b, 0)
}

export function timeLimitMs(config: QuizConfig, count = totalQuestions(config)): number | null {
  switch (config.timeMode) {
    case "ufficiale":
    case "personalizzato":
      return config.totalMinutes * 60_000
    case "per-domanda":
      return count * config.secondsPerQuestion * 1000
    case "illimitato":
      return null
  }
}

export function maxScoreFor(config: QuizConfig) {
  const n = totalQuestions(config)
  const hard = Math.round((n * targetHardPercent(config)) / 100)
  return hard * config.scoring.correctHard + (n - hard) * config.scoring.correctEasy
}

export function buildSession(
  config: QuizConfig,
  bank: Question[],
  progress: Record<string, QuestionProgress>,
) {
  if (config.questionIds) {
    const byId = new Map(bank.map((q) => [q.id, q]))
    const fixed = config.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q)
    const ordered = config.questionOrder === "casuale" ? shuffle(fixed) : fixed
    const session: QuizSession = {
      id: uid(),
      config,
      startedAt: Date.now(),
      questions: ordered.map((q) => {
        const idx = q.options.map((_, i) => i)
        return { questionId: q.id, optionOrder: config.answerOrder === "casuale" ? shuffle(idx) : idx }
      }),
    }
    return { session, shortfalls: [] as { subject: SubjectId; requested: number; got: number }[] }
  }

  const hardPct = targetHardPercent(config)
  const allowMixFill = config.difficultyMode === "bilanciato" || config.difficultyMode === "personalizzato"
  const picked: Question[] = []
  const shortfalls: { subject: SubjectId; requested: number; got: number }[] = []

  for (const s of SUBJECTS) {
    const n = config.subjects[s.id] ?? 0
    if (n <= 0) continue
    const pool = bank.filter((q) => q.subject === s.id && matchesPool(q, config.pool, progress))
    const easy = shuffle(pool.filter((q) => q.difficulty === "facile"))
    const hard = shuffle(pool.filter((q) => q.difficulty === "difficile"))
    const wantHard = Math.round((n * hardPct) / 100)
    const wantEasy = n - wantHard
    const takeHard = hard.slice(0, wantHard)
    const takeEasy = easy.slice(0, wantEasy)
    let chosen = [...takeHard, ...takeEasy]
    if (allowMixFill && chosen.length < n) {
      const rest = [...hard.slice(takeHard.length), ...easy.slice(takeEasy.length)]
      chosen = [...chosen, ...rest.slice(0, n - chosen.length)]
    }
    if (chosen.length < n) shortfalls.push({ subject: s.id, requested: n, got: chosen.length })
    picked.push(...shuffle(chosen))
  }

  const ordered = config.questionOrder === "casuale" ? shuffle(picked) : picked

  const session: QuizSession = {
    id: uid(),
    config,
    startedAt: Date.now(),
    questions: ordered.map((q) => {
      const idx = q.options.map((_, i) => i)
      return { questionId: q.id, optionOrder: config.answerOrder === "casuale" ? shuffle(idx) : idx }
    }),
  }
  return { session, shortfalls }
}

export function pointsFor(q: Question, selected: number | null, config: QuizConfig) {
  if (selected === null) return config.scoring.blank
  if (selected === q.correctIndex) {
    return q.difficulty === "difficile" ? config.scoring.correctHard : config.scoring.correctEasy
  }
  return config.scoring.wrong
}

export function gradeSession(
  session: QuizSession,
  answers: Record<string, AnswerState>,
  bankById: Map<string, Question>,
  durationMs: number,
): Attempt {
  const results: AttemptQuestionResult[] = []
  let score = 0
  let maxScore = 0
  let correct = 0
  let wrong = 0
  let blank = 0
  for (const sq of session.questions) {
    const q = bankById.get(sq.questionId)
    if (!q) continue
    const a = answers[sq.questionId]
    const selected = a?.selected ?? null
    const isCorrect = selected === q.correctIndex
    const points = pointsFor(q, selected, session.config)
    score += points
    maxScore += q.difficulty === "difficile" ? session.config.scoring.correctHard : session.config.scoring.correctEasy
    if (selected === null) blank++
    else if (isCorrect) correct++
    else wrong++
    results.push({
      questionId: q.id,
      subject: q.subject,
      difficulty: q.difficulty,
      selected,
      correct: isCorrect,
      doubt: a?.doubt ?? false,
      timeSpentMs: a?.timeSpentMs ?? 0,
      points,
    })
  }
  const configuredMax = maxScoreFor(session.config)
  const scaledThreshold =
    configuredMax > 0 ? Math.round((session.config.passThreshold * maxScore) / configuredMax) : 0
  return {
    id: session.id,
    name: session.config.name,
    official: session.config.official,
    date: Date.now(),
    durationMs,
    score,
    maxScore,
    passThreshold: scaledThreshold,
    correct,
    wrong,
    blank,
    results,
  }
}

export function applyAttemptToProgress(
  progress: Record<string, QuestionProgress>,
  attempt: Attempt,
): Record<string, QuestionProgress> {
  const next = { ...progress }
  for (const r of attempt.results) {
    const prev = next[r.questionId]
    next[r.questionId] = {
      status: r.selected === null ? "saltata" : r.correct ? "corretta" : "errata",
      attempts: (prev?.attempts ?? 0) + 1,
      correctCount: (prev?.correctCount ?? 0) + (r.correct ? 1 : 0),
      doubt: r.doubt,
      lastSeen: attempt.date,
    }
  }
  return next
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":")
}
