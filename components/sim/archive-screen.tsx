"use client"

import { Download, ExternalLink, FileText, Pencil, Play, Search, Sparkles, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useJobs } from "@/lib/quiz/jobs"
import { deleteSimulation, downloadSimPdf, exportJson, openSimPdfInTab, runAiSolve } from "@/lib/quiz/pipeline"
import { DEFAULT_SETTINGS } from "@/lib/quiz/prompts"
import { updateQuestions, updateSimulations, upsertQuestions, useSettings, useSimulations } from "@/lib/quiz/storage"
import { SUBJECT_SHORT, SUBJECTS } from "@/lib/quiz/subjects"
import { isSolved, type Question, type Simulation, type SubjectId } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { JobLog } from "./job-log"
import { QuestionEditor } from "./question-editor"
import { Section, Segmented, TopBar } from "./primitives"

const PAGE = 40

type Tab = "domande" | "prove"

export function ArchiveScreen({
  bank,
  importedIds,
  onPlay,
  onBack,
}: {
  bank: Question[]
  importedIds: Set<string>
  onPlay: (sim: Simulation, questions: Question[]) => void
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>("domande")
  const [sims] = useSimulations()
  const [stored] = useSettings()
  const settings = { ...DEFAULT_SETTINGS, ...stored }
  const solveJobs = useJobs().filter((j) => j.kind === "ai-risolvi")

  const [query, setQuery] = useState("")
  const [source, setSource] = useState<string>("tutte")
  const [subject, setSubject] = useState<SubjectId | "tutte">("tutte")
  const [onlyUnsolved, setOnlyUnsolved] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<string | null>(null)

  const simById = useMemo(() => new Map(sims.map((s) => [s.id, s])), [sims])
  const pdfNames = useMemo(() => [...new Set(bank.map((q) => q.sourcePdf).filter((x): x is string => !!x))].sort(), [bank])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bank
      .filter((x) => {
        if (source === "predefinite" && x.sourcePdf) return false
        if (source !== "tutte" && source !== "predefinite" && x.sourcePdf !== source) return false
        if (subject !== "tutte" && x.subject !== subject) return false
        if (onlyUnsolved && isSolved(x)) return false
        if (q && !`${x.text} ${x.options.join(" ")} ${x.topic ?? ""} ${x.number ?? ""}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => (a.sourcePdf ?? "").localeCompare(b.sourcePdf ?? "") || (a.number ?? 0) - (b.number ?? 0))
  }, [bank, query, source, subject, onlyUnsolved])

  const questionsOf = (simId: string) =>
    bank.filter((q) => q.simulationId === simId).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))

  return (
    <main className="mx-auto min-h-dvh max-w-lg pb-12">
      <TopBar title="Archivio quiz" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4">
        <Segmented
          label="Sezione archivio"
          value={tab}
          onChange={(v) => {
            setTab(v)
            setEditing(null)
          }}
          options={[
            { value: "domande", label: `Domande (${bank.length})` },
            { value: "prove", label: `Prove e PDF (${sims.length})` },
          ]}
        />

        {tab === "domande" ? (
          <>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">Cerca</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setLimit(PAGE)
                  }}
                  placeholder="Cerca testo, risposta, numero..."
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="sr-only" htmlFor="archive-source">
                  PDF di origine
                </label>
                <select
                  id="archive-source"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value)
                    setLimit(PAGE)
                  }}
                  className="min-w-0 rounded-xl border border-border bg-secondary px-2 py-2.5"
                >
                  <option value="tutte">Tutti i PDF</option>
                  <option value="predefinite">Solo predefinite</option>
                  {pdfNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="archive-subject">
                  Materia
                </label>
                <select
                  id="archive-subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value as SubjectId | "tutte")
                    setLimit(PAGE)
                  }}
                  className="min-w-0 rounded-xl border border-border bg-secondary px-2 py-2.5"
                >
                  <option value="tutte">Tutte le materie</option>
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.short}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={onlyUnsolved} onChange={(e) => setOnlyUnsolved(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                Solo senza risposta corretta
              </label>
              <p className="text-xs text-muted-foreground">{filtered.length} risultati</p>
            </div>

            <ul className="flex flex-col gap-2">
              {filtered.slice(0, limit).map((q) =>
                editing === q.id ? (
                  <li key={q.id}>
                    <QuestionEditor
                      question={q}
                      sim={q.simulationId ? simById.get(q.simulationId) : undefined}
                      deletable={importedIds.has(q.id)}
                      onClose={() => setEditing(null)}
                      onSave={async (next) => {
                        await upsertQuestions([next])
                        setEditing(null)
                      }}
                      onDelete={async () => {
                        await updateQuestions((prev) => prev.filter((x) => x.id !== q.id))
                        setEditing(null)
                      }}
                    />
                  </li>
                ) : (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(q.id)}
                      className="flex w-full flex-col gap-1.5 rounded-2xl border border-border bg-card p-3 text-left"
                    >
                      <span className="flex items-center gap-2 text-[11px] font-bold">
                        {q.number !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">n. {q.number}</span>}
                        <span className="rounded-full bg-muted px-2 py-0.5">{SUBJECT_SHORT[q.subject]}</span>
                        {!isSolved(q) && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-warning">Senza soluzione</span>}
                        {q.edited && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">Modificata</span>}
                        <Pencil className="ml-auto size-3.5 text-muted-foreground" aria-hidden />
                      </span>
                      <span className="line-clamp-2 text-sm font-semibold">{q.text}</span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <FileText className="size-3 shrink-0" aria-hidden />
                        {q.sourcePdf ? `${q.sourcePdf}${q.page ? ` · p. ${q.page}` : ""}` : "Archivio predefinito"}
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
            {filtered.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="rounded-2xl bg-secondary py-3 text-sm font-bold">
                Mostra altre {Math.min(PAGE, filtered.length - limit)}
              </button>
            )}
          </>
        ) : (
          <>
            {sims.length === 0 && (
              <p className="rounded-2xl bg-secondary p-4 text-center text-sm text-muted-foreground">
                Nessun PDF importato. Vai su Importa domande per aggiungerne uno.
              </p>
            )}
            {[...sims]
              .sort((a, b) => Number(!!b.dedicated) - Number(!!a.dedicated) || b.createdAt - a.createdAt)
              .map((sim) => (
                <SimCard
                  key={sim.id}
                  sim={sim}
                  questions={questionsOf(sim.id)}
                  onPlay={onPlay}
                  onSolve={(qs) => runAiSolve(qs, settings, `Risoluzione AI · ${sim.name}`, sim.id)}
                />
              ))}
            {solveJobs.map((j) => (
              <JobLog key={j.id} job={j} />
            ))}
          </>
        )}
      </div>
    </main>
  )
}

function SimCard({
  sim,
  questions,
  onPlay,
  onSolve,
}: {
  sim: Simulation
  questions: Question[]
  onPlay: (sim: Simulation, qs: Question[]) => void
  onSolve: (qs: Question[]) => void
}) {
  const solved = questions.filter(isSolved)
  const unsolved = questions.length - solved.length
  const update = (patch: Partial<Simulation>) => updateSimulations((prev) => prev.map((s) => (s.id === sim.id ? { ...s, ...patch } : s)))

  return (
    <Section
      icon={FileText}
      title={sim.name}
      description={`${sim.fileName} · ${sim.pageCount} pag. · ${new Date(sim.createdAt).toLocaleDateString("it-IT")}`}
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="font-semibold">
          {questions.length} domande · {solved.length} con soluzione
          {unsolved > 0 && <span className="text-warning"> · {unsolved} da risolvere</span>}
        </p>

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3">
          <span>
            <span className="block font-bold">Spazio dedicato</span>
            <span className="text-xs text-muted-foreground">Le domande restano comunque nella banca dati generale</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={!!sim.dedicated}
            onChange={(e) => update({ dedicated: e.target.checked })}
            className="size-5 shrink-0 accent-[var(--primary)]"
          />
        </label>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {sim.dedicated && (
            <button
              type="button"
              disabled={solved.length === 0}
              onClick={() => onPlay(sim, solved)}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-primary-foreground disabled:opacity-40"
            >
              <Play className="size-3.5" aria-hidden />
              Avvia prova ({solved.length})
            </button>
          )}
          {unsolved > 0 && (
            <button
              type="button"
              onClick={() => onSolve(questions.filter((q) => !isSolved(q)))}
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-2"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Risolvi con AI
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const name = prompt("Nuovo nome della prova", sim.name)?.trim()
              if (name) {
                update({ name })
                updateQuestions((prev) => prev.map((q) => (q.simulationId === sim.id ? { ...q, sourceName: name } : q)))
              }
            }}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-2"
          >
            <Pencil className="size-3.5" aria-hidden />
            Rinomina
          </button>
          <button type="button" onClick={() => openSimPdfInTab(sim)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-2">
            <ExternalLink className="size-3.5" aria-hidden />
            Apri PDF
          </button>
          <button type="button" onClick={() => downloadSimPdf(sim)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-2">
            <Download className="size-3.5" aria-hidden />
            PDF
          </button>
          <button
            type="button"
            onClick={() => exportJson(questions, sim.name)}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-2"
          >
            <Download className="size-3.5" aria-hidden />
            JSON
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Eliminare "${sim.name}" e il suo PDF?`)) return
              const removeQuestions = confirm(
                "Vuoi eliminare anche le sue domande dalla banca dati generale?\nOK = elimina domande · Annulla = mantienile",
              )
              void deleteSimulation(sim.id, removeQuestions)
            }}
            className={cn("flex items-center gap-1 rounded-full bg-muted px-3 py-2 text-destructive")}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Elimina
          </button>
        </div>
      </div>
    </Section>
  )
}
