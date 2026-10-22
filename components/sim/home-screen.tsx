"use client"

import {
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  FileUp,
  Landmark,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  X,
  Library,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Attempt, QuestionProgress } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { formatScore } from "./results-screen"

export function HomeScreen({
  attempts,
  progress,
  bankSize,
  onOfficial,
  onCustom,
  onReview,
  onStats,
  onImport,
  onArchive,
}: {
  attempts: Attempt[]
  progress: Record<string, QuestionProgress>
  bankSize: number
  onOfficial: () => void
  onCustom: () => void
  onReview: () => void
  onStats: () => void
  onImport: () => void
  onArchive: () => void
}) {
  const recent = [...attempts].sort((a, b) => b.date - a.date).slice(0, 5)
  const avg = recent.length ? recent.reduce((s, a) => s + a.score, 0) / recent.length : null
  const values = Object.values(progress)
  const correct = values.filter((p) => p.status === "corretta").length
  const wrong = values.filter((p) => p.status === "errata").length
  const skipped = values.filter((p) => p.status === "saltata").length
  const toReview = values.filter((p) => p.status !== "corretta" || p.doubt).length
  const completion = bankSize ? Math.round((values.length / bankSize) * 100) : 0

  return (
    <div className="min-h-dvh pb-10">
      <header className="px-4 pb-2 pt-[max(env(safe-area-inset-top),1rem)]">
        <h1 className="mx-auto max-w-lg text-center text-lg font-extrabold">Simulatore GdF</h1>
      </header>
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-3 pt-2">
        <section className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-[0_0_40px_-10px] shadow-primary/60">
          <div className="flex gap-4">
            <div className="flex-1">
              <h2 className="text-balance text-2xl font-black leading-tight">
                Allievi Marescialli della Guardia di Finanza
              </h2>
              <p className="mt-4 flex items-center gap-2 font-extrabold opacity-90">
                <Landmark className="size-5" aria-hidden />
                G.d.F.
              </p>
            </div>
            <div className="flex w-36 shrink-0 flex-col rounded-2xl bg-white p-3 text-[#2e3240]">
              <p className="text-sm font-black leading-tight text-[#6b74a8]">Punteggio medio</p>
              <p className="text-xs font-bold text-[#9aa3bd]">ultime 5 prove</p>
              <p className="mt-auto pt-3 text-3xl font-black tabular-nums">
                {avg === null ? "—" : formatScore(Math.round(avg * 10) / 10)}
              </p>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={onOfficial}
          className="flex items-center justify-center gap-3 rounded-3xl bg-primary py-5 text-xl font-black text-primary-foreground shadow-[0_0_30px_-8px] shadow-primary/70 transition active:scale-[0.98]"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-white/25">
            <Play className="size-5" fill="currentColor" aria-hidden />
          </span>
          Avvia simulazione ufficiale
        </button>

        <section className="rounded-3xl bg-card p-5">
          <div className="grid grid-cols-2 divide-x divide-border">
            <InfoCell icon={ClipboardList} label="Domande" value="100" />
            <InfoCell icon={Timer} label="Tempo" value="1h 40m" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 border-t border-border pt-4 text-lg font-black">
            <span className="flex items-center gap-2 text-success">
              <Check className="size-5" aria-hidden />
              <span className="sr-only">Esatte facili</span>+1 / +3
            </span>
            <span className="flex items-center gap-2 text-warning">
              <span className="size-4 rounded-full border-2 border-warning" aria-hidden />
              <span className="sr-only">Non date</span>0
            </span>
            <span className="flex items-center gap-2 text-destructive">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Errate</span>0
            </span>
          </div>
        </section>

        <nav aria-label="Sezioni" className="flex flex-col gap-3">
          <MenuRow
            icon={SlidersHorizontal}
            title="Prova personalizzata"
            subtitle="Scegli domande, difficoltà, punteggio e tempo"
            onClick={onCustom}
            highlight
          />
          <MenuRow
            icon={RotateCcw}
            title="Ripasso errori e dubbi"
            subtitle={toReview ? `${toReview} domande da ripassare` : "Nessuna domanda da ripassare"}
            onClick={onReview}
            disabled={toReview === 0}
          />
          <MenuRow icon={BarChart3} title="Statistiche" subtitle={`${attempts.length} prove svolte`} onClick={onStats} />
          <MenuRow icon={Library} title="Archivio quiz" subtitle={`${bankSize} domande · cerca e modifica`} onClick={onArchive} />
          <MenuRow icon={FileUp} title="Importa domande" subtitle="PDF con Gemini, JSON o testo" onClick={onImport} />
        </nav>

        <section className="rounded-3xl bg-card p-5">
          <div className="flex items-center gap-4">
            <div
              className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--primary) ${completion}%, var(--secondary) 0)` }}
              aria-hidden
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-card text-sm font-black text-accent-foreground">
                {completion}%
              </span>
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Completamento archivio</h2>
              <p className="text-sm text-muted-foreground">
                {values.length} di {bankSize} domande viste
              </p>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            <Level dot="bg-success" label="Le sai" value={correct} />
            <Level dot="bg-destructive" label="Non le sai" value={wrong} />
            <Level dot="bg-warning" label="Saltate" value={skipped} />
            <Level dot="bg-foreground" label="Mai viste" value={bankSize - values.length} />
          </ul>
        </section>

        {recent.length > 0 && (
          <section className="rounded-3xl bg-card p-5">
            <h2 className="mb-3 text-lg font-extrabold">Ultime 5 prove</h2>
            <ul className="flex flex-col gap-2">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString("it-IT")}</p>
                  </div>
                  <span
                    className={cn(
                      "font-black tabular-nums",
                      a.score >= a.passThreshold ? "text-success" : "text-warning",
                    )}
                  >
                    {formatScore(a.score)}/{a.maxScore}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function InfoCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="font-bold text-muted-foreground">{label}</span>
      <span className="text-3xl font-black">{value}</span>
    </div>
  )
}

function MenuRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  disabled,
  highlight,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-4 rounded-3xl bg-card p-4 text-left transition active:scale-[0.99] disabled:opacity-50",
        highlight && "ring-2 ring-primary/60",
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold">{title}</span>
        <span className="block text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </button>
  )
}

function Level({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
      <span className="flex-1 font-semibold text-secondary-foreground">{label}</span>
      <span className="font-black tabular-nums">{value}</span>
    </li>
  )
}
