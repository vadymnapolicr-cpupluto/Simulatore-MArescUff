"use client"

import { useMemo, useState } from "react"
import { applyAttemptToProgress, buildSession, gradeSession } from "@/lib/quiz/engine"
import { SEED_QUESTIONS } from "@/lib/quiz/seed-questions"
import { OFFICIAL_CONFIG } from "@/lib/quiz/subjects"
import { useAttempts, useImportedQuestions, useLastConfig, useProgress } from "@/lib/quiz/storage"
import { isSolved, type AnswerState, type Attempt, type Question, type QuizConfig, type QuizSession, type Simulation } from "@/lib/quiz/types"
import { ArchiveScreen } from "./archive-screen"
import { CustomBuilder } from "./custom-builder"
import { HomeScreen } from "./home-screen"
import { ImportScreen } from "./import-screen"
import { QuizRunner } from "./quiz-runner"
import { ResultsScreen } from "./results-screen"
import { StatsScreen } from "./stats-screen"

type View =
  | { name: "home" }
  | { name: "custom" }
  | { name: "quiz"; session: QuizSession }
  | { name: "results"; attempt: Attempt }
  | { name: "stats" }
  | { name: "import" }
  | { name: "archive" }

export function SimulatorApp() {
  const [view, setView] = useState<View>({ name: "home" })
  const [imported, setImported] = useImportedQuestions()
  const [attempts, setAttempts] = useAttempts()
  const [progress, setProgress] = useProgress()
  const [lastConfig, setLastConfig] = useLastConfig()

  const bank = useMemo(() => {
    const map = new Map(SEED_QUESTIONS.map((q) => [q.id, q]))
    for (const q of imported) map.set(q.id, q)
    return [...map.values()]
  }, [imported])
  const bankById = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank])
  const playable = useMemo(() => bank.filter(isSolved), [bank])
  const importedIds = useMemo(() => new Set(imported.map((q) => q.id)), [imported])

  const start = (config: QuizConfig) => {
    if (!config.official) setLastConfig(config)
    const { session } = buildSession(config, playable, progress)
    window.scrollTo(0, 0)
    setView({ name: "quiz", session })
  }

  const startReview = () => {
    const counts = { logica: 0, italiano: 0, storia: 0, civica: 0, inglese: 0, informatica: 0 }
    for (const q of bank) {
      const p = progress[q.id]
      if (p && (p.status !== "corretta" || p.doubt)) counts[q.subject]++
    }
    const reviewPool = { ...progress }
    for (const [id, p] of Object.entries(reviewPool)) {
      if (p.status !== "corretta" || p.doubt) reviewPool[id] = { ...p, doubt: true }
    }
    const config: QuizConfig = {
      ...OFFICIAL_CONFIG,
      name: "Ripasso errori",
      official: false,
      subjects: counts,
      pool: "dubbi",
      timeMode: "illimitato",
      mode: "esercizio",
      passThreshold: 0,
    }
    const { session } = buildSession(config, playable, reviewPool)
    window.scrollTo(0, 0)
    setView({ name: "quiz", session })
  }

  const playSpace = (sim: Simulation, qs: Question[]) => {
    const counts = { logica: 0, italiano: 0, storia: 0, civica: 0, inglese: 0, informatica: 0 }
    for (const q of qs) counts[q.subject]++
    start({
      ...OFFICIAL_CONFIG,
      name: sim.name,
      official: false,
      subjects: counts,
      questionIds: qs.map((q) => q.id),
      questionOrder: "materia",
      answerOrder: "ufficiale",
    })
  }

  const finish = (session: QuizSession, answers: Record<string, AnswerState>, durationMs: number) => {
    const attempt = gradeSession(session, answers, bankById, durationMs)
    setAttempts((prev) => [...prev, attempt])
    setProgress((prev) => applyAttemptToProgress(prev, attempt))
    window.scrollTo(0, 0)
    setView({ name: "results", attempt })
  }

  const home = () => {
    window.scrollTo(0, 0)
    setView({ name: "home" })
  }

  switch (view.name) {
    case "custom":
      return (
        <CustomBuilder
          bank={playable}
          progress={progress}
          initialConfig={lastConfig ?? { ...OFFICIAL_CONFIG, name: "Prova personalizzata", official: false }}
          onStart={start}
          onBack={home}
        />
      )
    case "quiz":
      return (
        <QuizRunner
          key={view.session.id}
          session={view.session}
          bankById={bankById}
          onFinish={(answers, ms) => finish(view.session, answers, ms)}
          onCancel={home}
        />
      )
    case "results":
      return <ResultsScreen attempt={view.attempt} bankById={bankById} onHome={home} onRetryWrong={startReview} />
    case "stats":
      return (
        <StatsScreen
          attempts={attempts}
          onBack={home}
          onReset={() => {
            setAttempts([])
            setProgress({})
          }}
        />
      )
    case "import":
      return (
        <ImportScreen
          imported={imported}
          onImport={(qs) =>
            setImported((prev) => {
              const map = new Map(prev.map((q) => [q.id, q]))
              for (const q of qs) map.set(q.id, q)
              return [...map.values()]
            })
          }
          onClear={() => setImported([])}
          onBack={home}
        />
      )
    case "archive":
      return <ArchiveScreen bank={bank} importedIds={importedIds} onPlay={playSpace} onBack={home} />
    default:
      return (
        <HomeScreen
          attempts={attempts}
          progress={progress}
          bankSize={bank.length}
          onOfficial={() => start(OFFICIAL_CONFIG)}
          onCustom={() => setView({ name: "custom" })}
          onReview={startReview}
          onStats={() => setView({ name: "stats" })}
          onImport={() => setView({ name: "import" })}
          onArchive={() => {
            window.scrollTo(0, 0)
            setView({ name: "archive" })
          }}
        />
      )
  }
}
