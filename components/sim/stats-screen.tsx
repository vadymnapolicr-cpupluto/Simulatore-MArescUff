"use client"

import { BarChart3, Clock, History, Trash2, TrendingUp } from "lucide-react"
import { useMemo, useState } from "react"
import { formatDuration } from "@/lib/quiz/engine"
import { SUBJECTS } from "@/lib/quiz/subjects"
import type { Attempt } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { Section, Segmented, TopBar } from "./primitives"
import { formatScore } from "./results-screen"

type Range = "settimana" | "mese" | "tutto"

export function StatsScreen({
  attempts,
  onBack,
  onReset,
}: {
  attempts: Attempt[]
  onBack: () => void
  onReset: () => void
}) {
  const [range, setRange] = useState<Range>("mese")
  const [confirmReset, setConfirmReset] = useState(false)

  const filtered = useMemo(() => {
    const now = Date.now()
    const span = range === "settimana" ? 7 : range === "mese" ? 30 : Infinity
    return attempts.filter((a) => now - a.date <= span * 86_400_000).sort((a, b) => a.date - b.date)
  }, [attempts, range])

  const pctOf = (a: Attempt) => (a.maxScore ? (Math.max(0, a.score) / a.maxScore) * 100 : 0)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

  const avgPct = avg(filtered.map(pctOf))
  const passRate = filtered.length ? (filtered.filter((a) => a.score >= a.passThreshold).length / filtered.length) * 100 : 0
  const half = Math.floor(filtered.length / 2)
  const improvement =
    filtered.length >= 4 ? avg(filtered.slice(half).map(pctOf)) - avg(filtered.slice(0, half).map(pctOf)) : null

  const officials = attempts.filter((a) => a.official)
  const bestOfficial = officials.reduce<number | null>((m, a) => (m === null || a.score > m ? a.score : m), null)

  const subjectStats = SUBJECTS.map((s) => {
    const rs = filtered.flatMap((a) => a.results.filter((r) => r.subject === s.id))
    return {
      ...s,
      total: rs.length,
      accuracy: rs.length ? (rs.filter((r) => r.correct).length / rs.length) * 100 : 0,
      avgTime: rs.length ? avg(rs.map((r) => r.timeSpentMs)) : 0,
    }
  })

  const chart = filtered.slice(-20)

  return (
    <div className="min-h-dvh pb-10">
      <TopBar title="Statistiche" onBack={onBack} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-3 pt-4">
        <Segmented
          label="Periodo"
          value={range}
          onChange={setRange}
          options={[
            { value: "settimana", label: "7 giorni" },
            { value: "mese", label: "30 giorni" },
            { value: "tutto", label: "Sempre" },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Prove" value={String(filtered.length)} />
          <Kpi label="Media" value={`${Math.round(avgPct)}%`} />
          <Kpi label="Superate" value={`${Math.round(passRate)}%`} />
          <Kpi
            label="Miglioramento"
            value={improvement === null ? "—" : `${improvement >= 0 ? "+" : ""}${Math.round(improvement)}%`}
            tone={improvement === null ? undefined : improvement >= 0 ? "text-success" : "text-destructive"}
          />
        </div>

        <Section icon={TrendingUp} title="Andamento punteggi">
          {chart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Completa una prova per vedere il grafico.</p>
          ) : (
            <div
              className="flex h-40 items-end gap-1.5"
              role="img"
              aria-label={`Andamento delle ultime ${chart.length} prove`}
            >
              {chart.map((a) => {
                const p = pctOf(a)
                const passed = a.score >= a.passThreshold
                return (
                  <div key={a.id} className="flex h-full flex-1 flex-col justify-end">
                    <div
                      className={cn("min-h-1 rounded-t-md", passed ? "bg-primary" : "bg-warning")}
                      style={{ height: `${p}%` }}
                      title={`${new Date(a.date).toLocaleDateString("it-IT")}: ${Math.round(p)}%`}
                    />
                  </div>
                )
              })}
            </div>
          )}
          <p className="mt-3 flex gap-4 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden /> Superata
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warning" aria-hidden /> Sotto soglia
            </span>
            {bestOfficial !== null && <span className="ml-auto">Record ufficiale: {formatScore(bestOfficial)}/200</span>}
          </p>
        </Section>

        <Section icon={BarChart3} title="Precisione e velocità per materia">
          <ul className="flex flex-col gap-3">
            {subjectStats.map((s) => (
              <li key={s.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-extrabold">{s.short}</span>
                  <span className="flex items-center gap-2 text-sm font-bold tabular-nums text-muted-foreground">
                    {Math.round(s.accuracy)}%
                    <Clock className="size-3.5" aria-hidden />
                    {Math.round(s.avgTime / 1000)}s
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${s.accuracy}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={History} title="Storico prove">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Al momento non hai prove.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {[...filtered].reverse().map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.date).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                      {formatDuration(a.durationMs)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-sm font-black tabular-nums",
                      a.score >= a.passThreshold ? "bg-accent text-accent-foreground" : "bg-warning/15 text-warning",
                    )}
                  >
                    {formatScore(a.score)}/{a.maxScore}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {confirmReset ? (
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmReset(false)} className="flex-1 rounded-2xl bg-muted py-3 font-black">
              Annulla
            </button>
            <button
              type="button"
              onClick={() => {
                onReset()
                setConfirmReset(false)
              }}
              className="flex-1 rounded-2xl bg-destructive py-3 font-black text-white"
            >
              Conferma reset
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 font-bold text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            Azzera storico e progressi
          </button>
        )}
      </main>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums", tone)}>{value}</p>
    </div>
  )
}
