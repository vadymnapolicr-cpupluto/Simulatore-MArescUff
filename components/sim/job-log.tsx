"use client"

import { Check, Copy, Download, Loader2, RotateCcw, Square, Terminal, TriangleAlert, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cancelJob, jobToText, type Job, type LogLevel } from "@/lib/quiz/jobs"
import { cn } from "@/lib/utils"

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-secondary-foreground",
  ok: "text-success",
  warn: "text-warning",
  error: "text-destructive",
}

const pretty = (raw: unknown) => (typeof raw === "string" ? raw : JSON.stringify(raw, null, 2))

export function JobLog({ job, onRetryFailed }: { job: Job; onRetryFailed?: (chunkIndexes: number[]) => void }) {
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)
  const errors = job.log.filter((e) => e.level === "error").length
  const failedChunks = job.steps
    .filter((s) => s.status === "errore" && /^c\d+$/.test(s.id))
    .map((s) => Number(s.id.slice(1)))
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0

  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [job.log.length])

  const copy = async () => {
    await navigator.clipboard.writeText(jobToText(job))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([jobToText(job)], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `log-${job.title.replace(/[^\w-]+/g, "_")}-${job.startedAt}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <article className="rounded-2xl border border-border bg-secondary/60 p-3">
      <header className="flex items-center gap-2">
        {job.running ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        ) : errors ? (
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
        ) : (
          <Check className="size-4 shrink-0 text-success" aria-hidden />
        )}
        <h3 className="min-w-0 flex-1 truncate text-sm font-extrabold">{job.title}</h3>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {job.done}/{job.total}
        </span>
      </header>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avanzamento"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div
        ref={consoleRef}
        role="log"
        aria-live="polite"
        className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-background p-2 font-mono text-[11px] leading-relaxed"
      >
        {job.log.length === 0 && <p className="text-muted-foreground">In attesa...</p>}
        {job.log.map((e, i) => (
          <div key={i} className="border-b border-border/40 py-1 last:border-0">
            <p className={LEVEL_CLASS[e.level]}>
              <span className="text-muted-foreground">{new Date(e.t).toLocaleTimeString("it-IT")} </span>
              {e.text}
            </p>
            {e.raw !== undefined && (
              <details open={e.level === "error"} className="mt-1">
                <summary className="cursor-pointer text-muted-foreground">
                  {e.level === "error" ? "Errore raw completo" : "Risposta raw"}
                </summary>
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-2 text-foreground">
                  {pretty(e.raw)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {showAll && (
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-background p-2 font-mono text-[11px]">
          {jobToText(job)}
        </pre>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        {job.running && (
          <button type="button" onClick={() => cancelJob(job.id)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-2 text-destructive">
            <Square className="size-3.5" aria-hidden />
            {job.cancelled ? "Annullamento..." : "Annulla"}
          </button>
        )}
        <button type="button" onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-2">
          {showAll ? <X className="size-3.5" aria-hidden /> : <Terminal className="size-3.5" aria-hidden />}
          {showAll ? "Chiudi log completo" : "Log completo raw"}
        </button>
        <button type="button" onClick={copy} className="flex items-center gap-1 rounded-full bg-muted px-3 py-2">
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copiato" : "Copia"}
        </button>
        <button type="button" onClick={download} className="flex items-center gap-1 rounded-full bg-muted px-3 py-2">
          <Download className="size-3.5" aria-hidden />
          Scarica .txt
        </button>
        {!job.running && failedChunks.length > 0 && onRetryFailed && (
          <button
            type="button"
            onClick={() => onRetryFailed(failedChunks)}
            className={cn("flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-primary-foreground")}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Riprova {failedChunks.length} blocchi falliti
          </button>
        )}
      </div>
    </article>
  )
}
