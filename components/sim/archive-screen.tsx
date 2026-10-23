"use client"

import {
  Download,
  ExternalLink,
  FileDown,
  FileJson,
  FileText,
  Filter,
  Layers,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { parseQuestions } from "@/lib/quiz/import"
import { useJobs } from "@/lib/quiz/jobs"
import { deleteSimulation, downloadSimPdf, exportJson, openSimPdfInTab, runAiSolve } from "@/lib/quiz/pipeline"
import { DEFAULT_SETTINGS } from "@/lib/quiz/prompts"
import { SEED_QUESTIONS } from "@/lib/quiz/seed-questions"
import {
  updateDeletedSeedIds,
  updateQuestions,
  updateSimulations,
  upsertQuestions,
  useDeletedSeedIds,
  useSettings,
  useSimulations,
} from "@/lib/quiz/storage"
import { SUBJECT_SHORT, SUBJECTS } from "@/lib/quiz/subjects"
import { isSolved, type Question, type Simulation, type SubjectId } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { JobLog } from "./job-log"
import { QuestionEditor } from "./question-editor"
import { Section, Segmented, TopBar } from "./primitives"

const PAGE = 40

type Tab = "domande" | "prove"
type ExportScope = "tutte" | "filtrate" | "materia" | "codice" | "risolte" | "non-risolte"

export function ArchiveScreen({
  bank,
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
  const [deletedSeeds] = useDeletedSeedIds()
  const settings = { ...DEFAULT_SETTINGS, ...stored }
  const solveJobs = useJobs().filter((j) => j.kind === "ai-risolvi")

  const [query, setQuery] = useState("")
  const [source, setSource] = useState<string>("tutte")
  const [subject, setSubject] = useState<SubjectId | "tutte">("tutte")
  const [onlyUnsolved, setOnlyUnsolved] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // Stati del pannello di esportazione
  const [exportScope, setExportScope] = useState<ExportScope>("tutte")
  const [exportSubject, setExportSubject] = useState<SubjectId>("logica")
  const [exportCodePrefix, setExportCodePrefix] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const simById = useMemo(() => new Map(sims.map((s) => [s.id, s])), [sims])
  const pdfNames = useMemo(() => [...new Set(bank.map((q) => q.sourcePdf).filter((x): x is string => !!x))].sort(), [bank])

  // Rileva codici prefisso presenti (es: M01, M05, A01...)
  const codePrefixes = useMemo(() => {
    const set = new Set<string>()
    for (const q of bank) {
      if (q.code) {
        const m = /^([MAU]\d{2})/.exec(q.code)
        if (m) set.add(m[1])
      }
    }
    return [...set].sort()
  }, [bank])

  // Seleziona il primo codice prefisso se non ancora impostato
  useMemo(() => {
    if (!exportCodePrefix && codePrefixes.length > 0) {
      setExportCodePrefix(codePrefixes[0])
    }
  }, [codePrefixes, exportCodePrefix])

  // Trova l'ultimo batch di aggiunta in blocco
  const lastBatchId = useMemo(() => {
    const list = bank.filter((q) => !!q.batchId)
    return list.length ? list[list.length - 1].batchId : null
  }, [bank])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bank
      .filter((x) => {
        if (source === "predefinite" && x.sourcePdf) return false
        if (source !== "tutte" && source !== "predefinite" && x.sourcePdf !== source) return false
        if (subject !== "tutte" && x.subject !== subject) return false
        if (onlyUnsolved && isSolved(x)) return false
        if (q) {
          const haystack = `${x.code ?? ""} ${x.text} ${x.options.join(" ")} ${x.topic ?? ""} ${x.number ?? ""}`.toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "") || (a.number ?? 0) - (b.number ?? 0))
  }, [bank, query, source, subject, onlyUnsolved])

  // Calcolo delle domande da esportare in base al filtro scelto nel modal
  const exportTargetQuestions = useMemo(() => {
    switch (exportScope) {
      case "filtrate":
        return filtered
      case "materia":
        return bank.filter((q) => q.subject === exportSubject)
      case "codice":
        return exportCodePrefix ? bank.filter((q) => q.code?.startsWith(exportCodePrefix)) : []
      case "risolte":
        return bank.filter(isSolved)
      case "non-risolte":
        return bank.filter((q) => !isSolved(q))
      case "tutte":
      default:
        return bank
    }
  }, [exportScope, bank, filtered, exportSubject, exportCodePrefix])

  const handleExecuteExport = () => {
    if (exportTargetQuestions.length === 0) {
      alert("Nessuna domanda corrisponde al filtro di esportazione selezionato.")
      return
    }
    const dateStr = new Date().toISOString().slice(0, 10)
    let fileName = `quiz-gdf-${dateStr}`
    if (exportScope === "filtrate") fileName = `quiz-gdf-filtrate-${dateStr}`
    else if (exportScope === "materia") fileName = `quiz-gdf-${exportSubject}-${dateStr}`
    else if (exportScope === "codice") fileName = `quiz-gdf-${exportCodePrefix}-${dateStr}`
    else if (exportScope === "risolte") fileName = `quiz-gdf-risolte-${dateStr}`
    else if (exportScope === "non-risolte") fileName = `quiz-gdf-senza-soluzione-${dateStr}`

    exportJson(exportTargetQuestions, fileName)
    setExportOpen(false)
  }

  // Importazione diretta da file JSON
  const handleDirectJsonImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const { questions, errors } = parseQuestions(text)
      if (questions.length === 0) {
        alert(errors[0] || "Nessun quesito valido trovato nel file.")
        return
      }
      await upsertQuestions(questions)
      alert(`Importate con successo ${questions.length} domande dal file JSON!`)
      setExportOpen(false)
    } catch (e) {
      alert(`Errore lettura file: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const questionsOf = (simId: string) =>
    bank.filter((q) => q.simulationId === simId).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))

  const handlePurgeAll = async () => {
    if (!confirm("ATTENZIONE: Stai per SVUOTARE COMPLETAMENTE L'ARCHIVIO (tutte le domande, sia importate che predefinite verranno rimosse).\n\nConfermi?")) return
    await updateQuestions(() => [])
    await updateDeletedSeedIds(() => SEED_QUESTIONS.map((s) => s.id))
    setManageOpen(false)
  }

  const handleRestoreSeeds = async () => {
    await updateDeletedSeedIds(() => [])
    alert("Domande predefinite ripristinate con successo!")
  }

  const handlePurgeLastBatch = async () => {
    if (!lastBatchId) {
      alert("Nessun blocco recente tracciato da eliminare.")
      return
    }
    const count = bank.filter((q) => q.batchId === lastBatchId).length
    if (!confirm(`Vuoi eliminare l'ultimo blocco importato (${count} domande)?`)) return
    await updateQuestions((prev) => prev.filter((q) => q.batchId !== lastBatchId))
  }

  const handlePurgeByCode = async (prefix: string) => {
    const toRemove = bank.filter((q) => q.code?.startsWith(prefix))
    if (!confirm(`Eliminare tutte le ${toRemove.length} domande con codice ${prefix}...?`)) return
    const ids = new Set(toRemove.map((q) => q.id))
    await updateQuestions((prev) => prev.filter((q) => !ids.has(q.id)))
    await updateDeletedSeedIds((prev) => [...new Set([...prev, ...toRemove.filter((q) => q.id.startsWith("seed-") || q.id.startsWith("gen-")).map((q) => q.id)])])
  }

  const handlePurgeBySubject = async (sub: SubjectId) => {
    const toRemove = bank.filter((q) => q.subject === sub)
    if (!confirm(`Eliminare tutte le ${toRemove.length} domande di ${SUBJECT_SHORT[sub]}?`)) return
    const ids = new Set(toRemove.map((q) => q.id))
    await updateQuestions((prev) => prev.filter((q) => !ids.has(q.id)))
    await updateDeletedSeedIds((prev) => [...new Set([...prev, ...toRemove.filter((q) => q.id.startsWith("seed-") || q.id.startsWith("gen-")).map((q) => q.id)])])
  }

  const handleDeleteSingle = async (id: string) => {
    await updateQuestions((prev) => prev.filter((x) => x.id !== id))
    if (id.startsWith("seed-") || id.startsWith("gen-")) {
      await updateDeletedSeedIds((prev) => [...prev, id])
    }
    setEditing(null)
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg pb-12">
      <TopBar
        title="Archivio quiz"
        onBack={onBack}
        right={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setExportOpen((v) => !v)
                setManageOpen(false)
              }}
              title="Esporta o importa quiz JSON"
              aria-label="Esporta o importa quiz"
              className={cn(
                "flex size-10 items-center justify-center rounded-full border transition",
                exportOpen ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-primary",
              )}
            >
              <FileDown className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setManageOpen((v) => !v)
                setExportOpen(false)
              }}
              title="Gestione e svuota archivio"
              aria-label="Gestione e svuota archivio"
              className={cn(
                "flex size-10 items-center justify-center rounded-full border transition",
                manageOpen ? "border-destructive bg-destructive text-white" : "border-border bg-secondary text-destructive",
              )}
            >
              <Trash2 className="size-5" />
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-4">
        {/* Input file nascosto per importazione diretta JSON */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            void handleDirectJsonImport(f)
            e.target.value = ""
          }}
        />

        {/* Modal / Pannello Esporta Quiz con Filtri */}
        {exportOpen && (
          <div className="flex flex-col gap-3 rounded-3xl border border-primary/40 bg-card p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson className="size-5 text-primary" />
                <h3 className="text-sm font-black">Esporta o Importa Quiz (JSON)</h3>
              </div>
              <button type="button" onClick={() => setExportOpen(false)} className="text-xs font-bold text-muted-foreground">
                Chiudi
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Esporta i quiz in un file JSON universale completo di codice, risposte, spiegazioni e immagini, pronto per essere ri-importato.
            </p>

            <div className="flex flex-col gap-1.5 text-xs font-bold">
              <span className="text-muted-foreground uppercase text-[10px] tracking-wider">Cosa vuoi esportare:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setExportScope("tutte")}
                  className={cn(
                    "rounded-xl border p-2 text-left font-bold transition",
                    exportScope === "tutte" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary",
                  )}
                >
                  Tutto l&apos;archivio ({bank.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope("filtrate")}
                  className={cn(
                    "rounded-xl border p-2 text-left font-bold transition",
                    exportScope === "filtrate" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary",
                  )}
                >
                  Filtri a schermo ({filtered.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope("risolte")}
                  className={cn(
                    "rounded-xl border p-2 text-left font-bold transition",
                    exportScope === "risolte" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary",
                  )}
                >
                  Solo risolte ({bank.filter(isSolved).length})
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope("non-risolte")}
                  className={cn(
                    "rounded-xl border p-2 text-left font-bold transition",
                    exportScope === "non-risolte" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary",
                  )}
                >
                  Senza soluzione ({bank.filter((q) => !isSolved(q)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope("materia")}
                  className={cn(
                    "rounded-xl border p-2 text-left font-bold transition",
                    exportScope === "materia" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary",
                  )}
                >
                  Per materia...
                </button>
                {codePrefixes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExportScope("codice")}
                    className={cn(
                      "rounded-xl border p-2 text-left font-bold transition",
                      exportScope === "codice" ? "border-primary bg-accent text-accent-foreground" : "border-border bg-secondary",
                    )}
                  >
                    Per codice PDF...
                  </button>
                )}
              </div>
            </div>

            {exportScope === "materia" && (
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-muted-foreground">Scegli materia:</span>
                <select
                  value={exportSubject}
                  onChange={(e) => setExportSubject(e.target.value as SubjectId)}
                  className="rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({bank.filter((q) => q.subject === s.id).length} domande)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {exportScope === "codice" && (
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-bold text-muted-foreground">Scegli codice PDF:</span>
                <select
                  value={exportCodePrefix}
                  onChange={(e) => setExportCodePrefix(e.target.value)}
                  className="rounded-xl border border-border bg-secondary px-3 py-2 font-mono text-sm outline-none"
                >
                  {codePrefixes.map((pfx) => (
                    <option key={pfx} value={pfx}>
                      {pfx} ({bank.filter((q) => q.code?.startsWith(pfx)).length} domande)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-xl bg-secondary/80 p-2.5 text-xs font-semibold text-secondary-foreground">
              Verranno esportate: <strong className="text-primary">{exportTargetQuestions.length}</strong> domande in formato JSON standard.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={exportTargetQuestions.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-xs font-black text-primary-foreground disabled:opacity-50"
              >
                <Download className="size-4" /> Scarica JSON ({exportTargetQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-secondary px-3 py-2.5 text-xs font-bold text-secondary-foreground"
              >
                <Upload className="size-4" /> Importa JSON
              </button>
            </div>
          </div>
        )}

        {/* Pannello svuota archivio ed eliminazioni selettive */}
        {manageOpen && (
          <div className="flex flex-col gap-3 rounded-3xl border border-destructive/40 bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-destructive">Gestione ed Eliminazione Archivio</h3>
              <button type="button" onClick={() => setManageOpen(false)} className="text-xs font-bold text-muted-foreground">
                Chiudi
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Elimina tutto l&apos;archivio o cancella selettivamente per blocco, codice o materia.
            </p>

            <button
              type="button"
              onClick={handlePurgeAll}
              className="flex items-center justify-center gap-2 rounded-2xl bg-destructive py-3 text-sm font-black text-white"
            >
              <Trash2 className="size-4" /> Svuota archivio totale ({bank.length} domande)
            </button>

            {deletedSeeds.length > 0 && (
              <button
                type="button"
                onClick={handleRestoreSeeds}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-xs font-bold text-primary"
              >
                <RotateCcw className="size-3.5" /> Ripristina domande predefinite ({deletedSeeds.length})
              </button>
            )}

            {lastBatchId && (
              <button
                type="button"
                onClick={handlePurgeLastBatch}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-2 text-xs font-bold text-secondary-foreground"
              >
                <Layers className="size-3.5" /> Elimina ultima aggiunta in blocchi
              </button>
            )}

            {codePrefixes.length > 0 && (
              <div>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Elimina per codice PDF:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {codePrefixes.map((pfx) => (
                    <button
                      key={pfx}
                      type="button"
                      onClick={() => handlePurgeByCode(pfx)}
                      className="rounded-lg bg-secondary px-2.5 py-1 font-mono text-xs font-bold hover:bg-destructive hover:text-white"
                    >
                      {pfx} ({bank.filter((q) => q.code?.startsWith(pfx)).length})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Elimina per materia:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handlePurgeBySubject(s.id)}
                    className="rounded-lg bg-secondary p-1.5 text-center font-bold text-muted-foreground hover:bg-destructive hover:text-white"
                  >
                    {s.short} ({bank.filter((q) => q.subject === s.id).length})
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
                  placeholder="Cerca codice (es. M05N67), testo, risposta..."
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <select
                  aria-label="PDF di origine"
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

                <select
                  aria-label="Materia"
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

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={onlyUnsolved} onChange={(e) => setOnlyUnsolved(e.target.checked)} className="size-4 accent-primary" />
                  Solo senza risposta corretta
                </label>
                <span className="text-muted-foreground">{filtered.length} risultati</span>
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {filtered.slice(0, limit).map((q) =>
                editing === q.id ? (
                  <li key={q.id}>
                    <QuestionEditor
                      question={q}
                      sim={q.simulationId ? simById.get(q.simulationId) : undefined}
                      deletable={true}
                      onClose={() => setEditing(null)}
                      onSave={async (next) => {
                        await upsertQuestions([next])
                        setEditing(null)
                      }}
                      onDelete={() => handleDeleteSingle(q.id)}
                    />
                  </li>
                ) : (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(q.id)}
                      className="flex w-full flex-col gap-1.5 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/50"
                    >
                      <span className="flex items-center gap-2 text-[11px] font-bold">
                        {q.code ? (
                          <span className="rounded-md bg-primary/20 px-2 py-0.5 font-mono font-black text-primary">
                            {q.code}
                          </span>
                        ) : q.number !== undefined ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">n. {q.number}</span>
                        ) : null}
                        <span className="rounded-full bg-muted px-2 py-0.5">{SUBJECT_SHORT[q.subject]}</span>
                        <span className="rounded-full bg-muted px-1.5 py-0.5 capitalize">{q.difficulty}</span>
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
            className="size-5 shrink-0 accent-primary"
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