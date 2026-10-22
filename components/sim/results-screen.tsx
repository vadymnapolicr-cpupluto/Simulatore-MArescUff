"use client"

import { Check, Circle, Flag, RotateCcw, X } from "lucide-react"
import { useState } from "react"
import { formatDuration } from "@/lib/quiz/engine"
import { SUBJECTS, SUBJECT_LABEL } from "@/lib/quiz/subjects"
import type { Attempt, Question } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { Section, Segmented, TopBar } from "./primitives"

type Filter = "errate" | "dubbi" | "tutte"

export function ResultsScreen({
  attempt,
  bankById,
  onHome,
  onRetryWrong,
}: {
  attempt: Attempt
  bankById: Map<string, Question>
  onHome: () => void
  onRetryWrong: () => void
}) {
  const [filter, setFilter] = useState<Filter>("errate")
  const passed = attempt.score >= attempt.passThreshold
  const pct = attempt.maxScore ? Math.round((Math.max(0, attempt.score) / attempt.maxScore) * 100) : 0

  const bySubject = SUBJECTS.map((s) => {
    const rs = attempt.results.filter((r) => r.subject === s.id)
    return {
      ...s,
      total: rs.length,
      correct: rs.filter((r) => r.correct).length,
      points: rs.reduce((a, r) => a + r.points, 0),
      avgTime: rs.length ? rs.reduce((a, r) => a + r.timeSpentMs, 0) / rs.length : 0,
    }
  }).filter((s) => s.total > 0)

  const reviewItems = attempt.results.filter((r) =>
    filter === "errate" ? !r.correct : filter === "dubbi" ? r.doubt : true,
  )

  return (
    <div className="min-h-dvh pb-10">
      <TopBar title="Risultato" onBack={onHome} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-3 pt-4">
        <section
          className={cn(
            "relative overflow-hidden rounded-3xl p-6",
            passed ? "bg-primary text-primary-foreground" : "bg-[#5a2e33] text-foreground",
          )}
        >
          <p className="text-sm font-extrabold uppercase tracking-widest opacity-80">{attempt.name}</p>
          <p className="mt-2 text-6xl font-black tabular-nums">
            {formatScore(attempt.score)}
            <span className="text-2xl opacity-70"> / {attempt.maxScore}</span>
          </p>
          <p className="mt-2 text-lg font-extrabold">
            {passed ? "Prova superata" : "Sotto la soglia"} · soglia {attempt.passThreshold} pt
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-sm font-bold opacity-80">Durata {formatDuration(attempt.durationMs)}</p>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Check className="size-5" />} label="Esatte" value={attempt.correct} tone="text-success" />
          <Stat icon={<Circle className="size-5" />} label="Non date" value={attempt.blank} tone="text-warning" />
          <Stat icon={<X className="size-5" />} label="Errate" value={attempt.wrong} tone="text-destructive" />
        </div>

        <Section title="Per materia">
          <ul className="flex flex-col gap-3">
            {bySubject.map((s) => (
              <li key={s.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-extrabold">{s.short}</span>
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {s.correct}/{s.total} · {formatScore(s.points)} pt · {Math.round(s.avgTime / 1000)}s
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(s.correct / s.total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Revisione"
          action={
            attempt.wrong + attempt.blank > 0 ? (
              <button
                type="button"
                onClick={onRetryWrong}
                className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-extrabold text-accent-foreground"
              >
                <RotateCcw className="size-4" aria-hidden />
                Ripassa errori
              </button>
            ) : null
          }
        >
          <Segmented
            label="Filtro revisione"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "errate", label: "Errate/saltate" },
              { value: "dubbi", label: "In dubbio" },
              { value: "tutte", label: "Tutte" },
            ]}
          />
          <ul className="mt-4 flex flex-col gap-3">
            {reviewItems.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">Nessuna domanda in questo filtro.</li>
            )}
            {reviewItems.map((r) => {
              const q = bankById.get(r.questionId)
              if (!q) return null
              return (
                <li key={r.questionId} className="rounded-2xl bg-secondary p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    {SUBJECT_LABEL[q.subject]} · {q.difficulty}
                    {r.doubt && <Flag className="size-3.5 text-warning" aria-label="In dubbio" />}
                  </p>
                  <p className="font-bold">{q.text}</p>
                  <p className="mt-2 text-sm">
                    <span className="font-bold text-success">Corretta: </span>
                    {q.options[q.correctIndex]}
                  </p>
                  {r.selected !== null && !r.correct && (
                    <p className="text-sm">
                      <span className="font-bold text-destructive">Tua risposta: </span>
                      {q.options[r.selected]}
                    </p>
                  )}
                  {r.selected === null && <p className="text-sm font-bold text-warning">Non risposta</p>}
                  {q.explanation && <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>}
                </li>
              )
            })}
          </ul>
        </Section>

        <button type="button" onClick={onHome} className="rounded-full bg-muted py-4 text-lg font-black">
          Torna alla home
        </button>
      </main>
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-3xl bg-card p-4">
      <span className={tone} aria-hidden>
        {icon}
      </span>
      <span className={cn("text-2xl font-black tabular-nums", tone)}>{value}</span>
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
    </div>
  )
}

export function formatScore(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "")
}
