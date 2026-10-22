"use client"

import {
  AlertTriangle,
  ArrowDownUp,
  BookOpen,
  Check,
  Database,
  Gauge,
  GraduationCap,
  Layers,
  Target,
  Timer,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
  availability,
  formatDuration,
  maxScoreFor,
  targetHardPercent,
  timeLimitMs,
  totalQuestions,
} from "@/lib/quiz/engine"
import { OFFICIAL_DISTRIBUTION, PRESETS, SUBJECTS } from "@/lib/quiz/subjects"
import type {
  DifficultyMode,
  PoolFilter,
  Question,
  QuestionProgress,
  QuizConfig,
  ScoringRules,
  SubjectId,
  TimeMode,
} from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { BottomBar, PrimaryButton, Section, Segmented, Stepper, TopBar } from "./primitives"

const QUICK_TOTALS = [10, 20, 50, 100]

export function CustomBuilder({
  bank,
  progress,
  initialConfig,
  onStart,
  onBack,
}: {
  bank: Question[]
  progress: Record<string, QuestionProgress>
  initialConfig: QuizConfig
  onStart: (config: QuizConfig) => void
  onBack: () => void
}) {
  const [config, setConfig] = useState<QuizConfig>(initialConfig)
  const [activePreset, setActivePreset] = useState<string | null>(
    PRESETS.find((p) => p.config.name === initialConfig.name)?.id ?? null,
  )

  const update = (patch: Partial<QuizConfig>) => {
    setActivePreset(null)
    setConfig((c) => ({ ...c, name: "Prova personalizzata", official: false, ...patch }))
  }

  const avail = useMemo(() => availability(bank, config.pool, progress), [bank, config.pool, progress])
  const poolCounts = useMemo(() => {
    const pools: PoolFilter[] = ["tutte", "non-risposte", "errate", "dubbi"]
    return Object.fromEntries(
      pools.map((p) => {
        const a = availability(bank, p, progress)
        return [p, Object.values(a).reduce((s, d) => s + d.facile + d.difficile, 0)]
      }),
    ) as Record<PoolFilter, number>
  }, [bank, progress])

  const total = totalQuestions(config)
  const hardPct = targetHardPercent(config)
  const hardCount = Math.round((total * hardPct) / 100)
  const limit = timeLimitMs(config, total)
  const maxScore = maxScoreFor(config)

  const availableFor = (id: SubjectId) => {
    const a = avail[id]
    if (config.difficultyMode === "solo-facili") return a.facile
    if (config.difficultyMode === "solo-difficili") return a.difficile
    return a.facile + a.difficile
  }

  const shortfalls = SUBJECTS.filter((s) => config.subjects[s.id] > availableFor(s.id))
  const effectiveTotal = SUBJECTS.reduce((sum, s) => sum + Math.min(config.subjects[s.id], availableFor(s.id)), 0)

  const setSubject = (id: SubjectId, n: number) => update({ subjects: { ...config.subjects, [id]: n } })

  const toggleSubject = (id: SubjectId) =>
    setSubject(id, config.subjects[id] > 0 ? 0 : Math.max(1, Math.min(OFFICIAL_DISTRIBUTION[id], availableFor(id) || 1)))

  const scaleTo = (target: number) => {
    const active = SUBJECTS.filter((s) => config.subjects[s.id] > 0)
    const base = active.length ? active : SUBJECTS
    const weightSum = base.reduce((s, x) => s + OFFICIAL_DISTRIBUTION[x.id], 0)
    const next = Object.fromEntries(SUBJECTS.map((s) => [s.id, 0])) as Record<SubjectId, number>
    let assigned = 0
    base.forEach((s) => {
      next[s.id] = Math.floor((OFFICIAL_DISTRIBUTION[s.id] / weightSum) * target)
      assigned += next[s.id]
    })
    let i = 0
    while (assigned < target) {
      next[base[i % base.length].id]++
      assigned++
      i++
    }
    update({ subjects: next })
  }

  const setScoring = (patch: Partial<ScoringRules>) => update({ scoring: { ...config.scoring, ...patch } })

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setActivePreset(id)
    setConfig(p.config)
  }

  return (
    <div className="min-h-dvh pb-40">
      <TopBar title="Prova personalizzata" onBack={onBack} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-3 pt-4">
        <Section icon={Layers} title="Configurazioni rapide">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                aria-pressed={activePreset === p.id}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors",
                  activePreset === p.id ? "border-primary bg-accent" : "border-border bg-secondary",
                )}
              >
                <span className="block font-extrabold">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section
          icon={BookOpen}
          title="Materie e numero domande"
          action={<span className="text-sm font-black tabular-nums text-accent-foreground">{total}</span>}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Totale:</span>
            {QUICK_TOTALS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => scaleTo(n)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-sm font-extrabold",
                  total === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {SUBJECTS.map((s) => {
              const enabled = config.subjects[s.id] > 0
              const available = availableFor(s.id)
              const short = config.subjects[s.id] > available
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSubject(s.id)}
                    aria-pressed={enabled}
                    aria-label={`${enabled ? "Escludi" : "Includi"} ${s.label}`}
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                      enabled ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                    )}
                  >
                    {enabled && <Check className="size-4" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-extrabold leading-tight", !enabled && "text-muted-foreground")}>{s.label}</p>
                    <p className={cn("text-xs", short ? "text-warning" : "text-muted-foreground")}>
                      {available} disponibili · {avail[s.id].facile}F / {avail[s.id].difficile}D
                    </p>
                  </div>
                  <div className="w-36 shrink-0">
                    <Stepper
                      label={`domande di ${s.label}`}
                      value={config.subjects[s.id]}
                      onChange={(v) => setSubject(s.id, v)}
                      max={200}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section icon={Gauge} title="Difficoltà">
          <Segmented<DifficultyMode>
            label="Difficoltà"
            value={config.difficultyMode}
            onChange={(v) => update({ difficultyMode: v, hardPercent: v === "personalizzato" ? config.hardPercent : 50 })}
            options={[
              { value: "bilanciato", label: "50/50" },
              { value: "solo-facili", label: "Facili" },
              { value: "solo-difficili", label: "Difficili" },
              { value: "personalizzato", label: "Mix" },
            ]}
          />
          {config.difficultyMode === "personalizzato" && (
            <div className="mt-4">
              <label htmlFor="hard-pct" className="flex justify-between text-sm font-bold">
                <span>Percentuale difficili</span>
                <span className="tabular-nums text-accent-foreground">{config.hardPercent}%</span>
              </label>
              <input
                id="hard-pct"
                type="range"
                min={0}
                max={100}
                step={5}
                value={config.hardPercent}
                onChange={(e) => update({ hardPercent: Number(e.target.value) })}
                className="mt-2 w-full accent-primary"
              />
            </div>
          )}
          <div className="mt-4 flex gap-2 text-sm font-bold">
            <span className="flex-1 rounded-xl bg-secondary px-3 py-2 text-center">
              <span className="text-success">{total - hardCount}</span> facili
            </span>
            <span className="flex-1 rounded-xl bg-secondary px-3 py-2 text-center">
              <span className="text-warning">{hardCount}</span> difficili
            </span>
          </div>
        </Section>

        <Section icon={Database} title="Fonte delle domande">
          <ul className="flex flex-col gap-1">
            {(
              [
                { value: "tutte", label: "Tutte", dot: "bg-muted-foreground" },
                { value: "non-risposte", label: "Mai viste", dot: "bg-foreground" },
                { value: "errate", label: "Errate o saltate", dot: "bg-destructive" },
                { value: "dubbi", label: "Segnate in dubbio", dot: "bg-warning" },
              ] as { value: PoolFilter; label: string; dot: string }[]
            ).map((p) => {
              const active = config.pool === p.value
              return (
                <li key={p.value}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ pool: p.value })}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left"
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border-2",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                      )}
                    >
                      {active && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={cn("size-2.5 rounded-full", p.dot)} aria-hidden />
                    <span className="flex-1 font-semibold text-secondary-foreground">{p.label}</span>
                    <span className="font-black tabular-nums text-secondary-foreground">{poolCounts[p.value]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>

        <Section icon={Timer} title="Tempo">
          <Segmented<TimeMode>
            label="Modalità tempo"
            value={config.timeMode}
            onChange={(v) => update({ timeMode: v, totalMinutes: v === "ufficiale" ? 100 : config.totalMinutes })}
            options={[
              { value: "ufficiale", label: "100'" },
              { value: "personalizzato", label: "Totale" },
              { value: "per-domanda", label: "Per dom." },
              { value: "illimitato", label: "Libero" },
            ]}
          />
          {config.timeMode === "personalizzato" && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-bold">Minuti totali</span>
              <div className="w-40">
                <Stepper
                  label="minuti totali"
                  value={config.totalMinutes}
                  onChange={(v) => update({ totalMinutes: v })}
                  min={1}
                  max={300}
                  step={5}
                  suffix="min"
                />
              </div>
            </div>
          )}
          {config.timeMode === "per-domanda" && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-bold">Secondi per domanda</span>
              <div className="w-40">
                <Stepper
                  label="secondi per domanda"
                  value={config.secondsPerQuestion}
                  onChange={(v) => update({ secondsPerQuestion: v })}
                  min={10}
                  max={600}
                  step={10}
                  suffix="s"
                />
              </div>
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {limit === null
              ? "Nessun limite di tempo: il cronometro registra solo la durata."
              : `Durata complessiva ${formatDuration(limit)}${total ? ` · ${Math.round(limit / 1000 / total)}s a domanda` : ""}.`}
          </p>
        </Section>

        <Section icon={Target} title="Punteggio">
          <div className="grid grid-cols-2 gap-3">
            <ScoreField label="Esatta facile" tone="success">
              <Stepper label="punti esatta facile" tone="success" value={config.scoring.correctEasy} onChange={(v) => setScoring({ correctEasy: v })} min={0} max={10} step={0.5} />
            </ScoreField>
            <ScoreField label="Esatta difficile" tone="success">
              <Stepper label="punti esatta difficile" tone="success" value={config.scoring.correctHard} onChange={(v) => setScoring({ correctHard: v })} min={0} max={10} step={0.5} />
            </ScoreField>
            <ScoreField label="Errata" tone="destructive">
              <Stepper label="punti errata" tone="destructive" value={config.scoring.wrong} onChange={(v) => setScoring({ wrong: v })} min={-5} max={5} step={0.25} />
            </ScoreField>
            <ScoreField label="Non risposta" tone="warning">
              <Stepper label="punti non risposta" tone="warning" value={config.scoring.blank} onChange={(v) => setScoring({ blank: v })} min={-5} max={5} step={0.25} />
            </ScoreField>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3">
            <div>
              <p className="text-sm font-bold">Soglia idoneità</p>
              <p className="text-xs text-muted-foreground">Massimo ottenibile: {maxScore} punti</p>
            </div>
            <div className="w-36">
              <Stepper
                label="soglia idoneità"
                value={config.passThreshold}
                onChange={(v) => update({ passThreshold: v })}
                min={0}
                max={Math.max(maxScore, 1)}
              />
            </div>
          </div>
        </Section>

        <Section icon={ArrowDownUp} title="Ordinamento">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Domande</p>
          <Segmented
            label="Ordine domande"
            value={config.questionOrder}
            onChange={(v) => update({ questionOrder: v })}
            options={[
              { value: "casuale", label: "Casuale" },
              { value: "materia", label: "Per materia" },
            ]}
          />
          <p className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Risposte</p>
          <Segmented
            label="Ordine risposte"
            value={config.answerOrder}
            onChange={(v) => update({ answerOrder: v })}
            options={[
              { value: "casuale", label: "Casuale" },
              { value: "ufficiale", label: "Ufficiale" },
            ]}
          />
        </Section>

        <Section icon={GraduationCap} title="Modalità">
          <Segmented
            label="Modalità"
            value={config.mode}
            onChange={(v) => update({ mode: v })}
            options={[
              { value: "esame", label: "Esame" },
              { value: "esercizio", label: "Esercizio" },
            ]}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {config.mode === "esame"
              ? "Correzione solo alla consegna, come in sede di concorso."
              : "Vedi subito se la risposta è giusta e la spiegazione."}
          </p>
        </Section>

        {shortfalls.length > 0 && (
          <div role="status" className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
            <p>
              Domande insufficienti per {shortfalls.map((s) => s.short).join(", ")}. La prova userà{" "}
              <strong>{effectiveTotal}</strong> domande. Importane altre dalla home.
            </p>
          </div>
        )}
      </main>

      <BottomBar>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Selezionati</p>
          <p className="text-2xl font-black tabular-nums">{effectiveTotal}</p>
        </div>
        <PrimaryButton disabled={effectiveTotal === 0} onClick={() => onStart(config)}>
          Avvia
        </PrimaryButton>
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Durata</p>
          <p className="text-lg font-black tabular-nums">{limit === null ? "∞" : formatDuration(limit)}</p>
        </div>
      </BottomBar>
    </div>
  )
}

function ScoreField({
  label,
  tone,
  children,
}: {
  label: string
  tone: "success" | "warning" | "destructive"
  children: React.ReactNode
}) {
  const dot = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" }[tone]
  return (
    <div className="rounded-2xl bg-muted/40 p-2">
      <p className="mb-2 flex items-center gap-2 px-1 text-xs font-extrabold text-muted-foreground">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden />
        {label}
      </p>
      {children}
    </div>
  )
}
