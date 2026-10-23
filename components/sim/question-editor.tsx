"use client"

import { ExternalLink, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"
import { useState } from "react"
import { openSimPdfInTab } from "@/lib/quiz/pipeline"
import { DEFAULT_SETTINGS } from "@/lib/quiz/prompts"
import { useSettings } from "@/lib/quiz/storage"
import { SUBJECTS } from "@/lib/quiz/subjects"
import type { Question, Simulation } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { PrimaryButton, Segmented } from "./primitives"

const LETTERS = "ABCDEFGH"

export function QuestionInfo({ q, sim }: { q: Question; sim?: Simulation }) {
  const rows: [string, string][] = []
  if (q.code) rows.push(["Codice", q.code])
  if (q.sourcePdf) rows.push(["PDF", q.sourcePdf])
  if (q.sourceName ?? sim?.name) rows.push(["Prova", (q.sourceName ?? sim?.name)!])
  if (q.page) rows.push(["Pagina", String(q.page)])
  if (q.number) rows.push(["Numero", String(q.number)])
  if (q.edited) rows.push(["Modificata", "Sì, a mano"])

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl bg-secondary p-3 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-bold text-muted-foreground">{k}</dt>
          <dd className="break-words font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function QuestionEditor({
  question,
  sim,
  deletable = true,
  onSave,
  onDelete,
  onClose,
}: {
  question: Question
  sim?: Simulation
  deletable?: boolean
  onSave: (q: Question) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Question>(question)
  const [replacing, setReplacing] = useState(false)
  const [replaceError, setReplaceError] = useState<string | null>(null)
  const [stored] = useSettings()
  const settings = { ...DEFAULT_SETTINGS, ...stored }

  const set = (patch: Partial<Question>) => setDraft((d) => ({ ...d, ...patch }))
  const valid = draft.text.trim() && draft.options.length >= 2 && draft.options.every((o) => o.trim())

  const setOption = (i: number, value: string) => set({ options: draft.options.map((o, j) => (j === i ? value : o)) })
  const removeOption = (i: number) =>
    set({
      options: draft.options.filter((_, j) => j !== i),
      correctIndex: draft.correctIndex === i ? -1 : draft.correctIndex > i ? draft.correctIndex - 1 : draft.correctIndex,
    })

  const handleAiReplace = async () => {
    setReplacing(true)
    setReplaceError(null)
    try {
      const res = await fetch("/api/ai/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          model: settings.model,
          currentQuestion: {
            subject: draft.subject,
            difficulty: draft.difficulty,
            topic: draft.topic,
            text: draft.text,
            options: draft.options,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Impossibile rigenerare la domanda.")

      const q = data.question
      const letterIdx = q.corretta.toUpperCase().charCodeAt(0) - 65
      set({
        text: q.domanda,
        options: q.risposte,
        correctIndex: letterIdx >= 0 && letterIdx < 4 ? letterIdx : 0,
        topic: q.argomento,
        explanation: q.spiegazione,
        edited: true,
      })
    } catch (e) {
      setReplaceError(e instanceof Error ? e.message : String(e))
    } finally {
      setReplacing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold">Modifica quesito</h3>
          {draft.code && <span className="rounded-md bg-primary/20 px-2 py-0.5 font-mono text-xs font-black text-primary">{draft.code}</span>}
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="flex size-9 items-center justify-center rounded-full bg-secondary">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <QuestionInfo q={question} sim={sim} />

      {sim && question.page && (
        <button
          type="button"
          onClick={() => openSimPdfInTab(sim, question.page)}
          className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-2 text-sm font-bold text-primary"
        >
          <ExternalLink className="size-4" aria-hidden />
          Apri PDF a pagina {question.page}
        </button>
      )}

      {/* Box Scritta male? Sostituisci con AI */}
      <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold text-warning">Scritta male o illeggibile?</p>
            <p className="text-[11px] text-muted-foreground">Rigenera una domanda simile via AI mantenendo materia e difficoltà.</p>
          </div>
          <button
            type="button"
            disabled={replacing}
            onClick={handleAiReplace}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-warning px-3 py-2 text-xs font-black text-black disabled:opacity-50"
          >
            {replacing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Sostituisci
          </button>
        </div>
        {replaceError && <p className="mt-2 text-xs font-semibold text-destructive">{replaceError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Codice (es. M05N67)</span>
          <input
            value={draft.code ?? ""}
            onChange={(e) => set({ code: e.target.value.toUpperCase().trim() })}
            placeholder="M05N01"
            className="rounded-xl border border-border bg-secondary px-3 py-2 font-mono text-sm uppercase outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Materia</span>
          <select
            value={draft.subject}
            onChange={(e) => set({ subject: e.target.value as Question["subject"] })}
            className="rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Testo domanda</span>
        <textarea
          rows={3}
          value={draft.text}
          onChange={(e) => set({ text: e.target.value })}
          className="rounded-xl border border-border bg-secondary p-2 outline-none focus:border-primary"
        />
      </label>

      {draft.image && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.image} alt="Figura della domanda" className="mx-auto max-h-48 rounded-xl bg-white" />
          <button
            type="button"
            onClick={() => set({ image: undefined })}
            className="absolute right-1 top-1 rounded-full bg-background/90 px-2 py-1 text-xs font-bold text-destructive"
          >
            Rimuovi figura
          </button>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">Risposte (seleziona la corretta)</legend>
        {draft.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <label
              className={cn(
                "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-xs font-black",
                draft.correctIndex === i ? "border-success bg-success text-background" : "border-border",
              )}
            >
              <input type="radio" name="correct" className="sr-only" checked={draft.correctIndex === i} onChange={() => set({ correctIndex: i })} />
              {LETTERS[i]}
              <span className="sr-only">corretta</span>
            </label>
            <input
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              aria-label={`Risposta ${LETTERS[i]}`}
              className="min-w-0 flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={draft.options.length <= 2}
              onClick={() => removeOption(i)}
              aria-label={`Rimuovi risposta ${LETTERS[i]}`}
              className="flex size-8 items-center justify-center text-muted-foreground disabled:opacity-30"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {draft.options.length < LETTERS.length && (
          <button
            type="button"
            onClick={() => set({ options: [...draft.options, ""] })}
            className="flex items-center justify-center gap-1 rounded-xl bg-secondary py-2 text-sm font-bold"
          >
            <Plus className="size-4" aria-hidden />
            Aggiungi risposta
          </button>
        )}
      </fieldset>

      <Segmented
        label="Difficoltà"
        value={draft.difficulty}
        onChange={(v) => set({ difficulty: v })}
        options={[
          { value: "facile", label: "Facile" },
          { value: "difficile", label: "Difficile" },
        ]}
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Argomento</span>
        <input
          value={draft.topic ?? ""}
          onChange={(e) => set({ topic: e.target.value || undefined })}
          className="rounded-xl border border-border bg-secondary px-3 py-2 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Spiegazione</span>
        <textarea
          rows={2}
          value={draft.explanation ?? ""}
          onChange={(e) => set({ explanation: e.target.value || undefined })}
          className="rounded-xl border border-border bg-secondary p-2 outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-2 pt-2">
        {deletable && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Eliminare definitivamente questo quesito dall'archivio?")) onDelete()
            }}
            className="flex items-center gap-1 rounded-full bg-secondary px-4 text-xs font-bold text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            Elimina
          </button>
        )}
        <PrimaryButton
          className="flex-1 py-2 text-sm"
          disabled={!valid}
          onClick={() =>
            onSave({ ...draft, text: draft.text.trim(), options: draft.options.map((o) => o.trim()), edited: true, updatedAt: Date.now() })
          }
        >
          Salva modifiche
        </PrimaryButton>
      </div>
    </div>
  )
}