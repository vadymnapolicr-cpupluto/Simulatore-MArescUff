"use client"

import { FileText, Settings2, Sparkles, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { clearFinishedJobs, useJobs } from "@/lib/quiz/jobs"
import { createSimulation, runAiExtraction } from "@/lib/quiz/pipeline"
import { DEFAULT_EXTRACT_PROMPT, DEFAULT_SETTINGS, MODEL_SUGGESTIONS } from "@/lib/quiz/prompts"
import { useSettings, useSimulations } from "@/lib/quiz/storage"
import type { AiSettings } from "@/lib/quiz/types"
import { JobLog } from "./job-log"
import { PrimaryButton, Section, Stepper } from "./primitives"

export function PdfImport() {
  const [stored, setStored] = useSettings()
  const settings: AiSettings = { ...DEFAULT_SETTINGS, ...stored }
  const [sims] = useSimulations()
  const jobs = useJobs().filter((j) => j.kind === "ai-estrai")
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [dedicated, setDedicated] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const ids = useId()

  const update = (patch: Partial<AiSettings>) => setStored((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch }))

  const start = async () => {
    if (!file) return
    setStartError(null)
    setStarting(true)
    try {
      const { sim } = await createSimulation(file, name.trim() || file.name.replace(/\.pdf$/i, ""), "ai", dedicated)
      setFile(null)
      setName("")
      void runAiExtraction(sim, settings)
    } catch (e) {
      setStartError(e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ""}` : String(e))
    } finally {
      setStarting(false)
    }
  }

  const retry = (simId: string | undefined, chunks: number[]) => {
    const sim = sims.find((s) => s.id === simId)
    if (sim) void runAiExtraction(sim, settings, chunks)
  }

  return (
    <Section
      icon={Sparkles}
      title="PDF → quesiti con Gemini"
      description={`Blocchi da ${settings.pagesPerChunk} pagine · ${settings.model}`}
      action={
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          aria-label="Impostazioni Gemini"
          className="flex size-10 items-center justify-center rounded-xl bg-secondary"
        >
          <Settings2 className="size-5" aria-hidden />
        </button>
      }
    >
      {showSettings && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-secondary p-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-bold">API key Gemini</span>
            <input
              type="password"
              autoComplete="off"
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="AIza... (vuoto = chiave del server)"
              className="rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">
              Salvata solo su questo dispositivo. Ottienila gratis su aistudio.google.com.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold">Modello</span>
            <input
              list={`${ids}-models`}
              value={settings.model}
              onChange={(e) => update({ model: e.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
            />
            <datalist id={`${ids}-models`}>
              {MODEL_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-bold">Pagine per blocco</span>
              <Stepper label="Pagine per blocco" value={settings.pagesPerChunk} min={1} max={10} onChange={(v) => update({ pagesPerChunk: v })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold">Tentativi</span>
              <Stepper label="Tentativi" value={settings.maxRetries} min={0} max={5} onChange={(v) => update({ maxRetries: v })} />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <span className="font-bold">Pausa tra blocchi</span>
              <Stepper label="Pausa tra blocchi" value={settings.delayMs} min={0} max={30000} step={500} suffix="ms" onChange={(v) => update({ delayMs: v })} />
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between font-bold">
              Prompt di estrazione
              <button type="button" onClick={() => update({ extractPrompt: DEFAULT_EXTRACT_PROMPT })} className="text-xs text-primary">
                Ripristina
              </button>
            </span>
            <textarea
              rows={6}
              value={settings.extractPrompt}
              onChange={(e) => update({ extractPrompt: e.target.value })}
              className="rounded-xl border border-border bg-background p-2 font-mono text-xs outline-none focus:border-primary"
            />
          </label>
        </div>
      )}

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-3 py-5 text-center font-bold text-muted-foreground">
        <FileText className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{file ? file.name : "Scegli il PDF del libretto"}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f && !name) setName(f.name.replace(/\.pdf$/i, ""))
            e.target.value = ""
          }}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="font-bold">Nome della prova</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Libretto tipo 2 - 2025"
          className="rounded-xl border border-border bg-secondary px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <label className="mt-3 flex items-start gap-3 rounded-2xl bg-secondary p-3 text-sm">
        <input type="checkbox" checked={dedicated} onChange={(e) => setDedicated(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
        <span>
          <span className="block font-bold">Crea anche uno spazio dedicato</span>
          <span className="text-muted-foreground">
            Le domande vanno sempre nella banca dati generale. Con questa opzione trovi anche la prova completa con il suo nome
            nell&apos;archivio, giocabile da sola.
          </span>
        </span>
      </label>

      <PrimaryButton className="mt-3 w-full" disabled={!file || starting} onClick={start}>
        {starting ? "Preparo..." : "Estrai con Gemini"}
      </PrimaryButton>

      {startError && (
        <pre role="alert" className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-background p-2 font-mono text-[11px] text-destructive">
          {startError}
        </pre>
      )}

      {jobs.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Log live</h3>
            {jobs.some((j) => !j.running) && (
              <button type="button" onClick={clearFinishedJobs} className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <Trash2 className="size-3.5" aria-hidden />
                Pulisci completati
              </button>
            )}
          </div>
          {jobs.map((j) => (
            <JobLog key={j.id} job={j} onRetryFailed={(c) => retry(j.simulationId, c)} />
          ))}
        </div>
      )}
    </Section>
  )
}
