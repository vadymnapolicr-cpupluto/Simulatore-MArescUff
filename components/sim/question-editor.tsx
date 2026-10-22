"use client"

import { ExternalLink, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { openSimPdfInTab } from "@/lib/quiz/pipeline"
import { SUBJECTS } from "@/lib/quiz/subjects"
import type { Question, Simulation } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"
import { PrimaryButton, Segmented } from "./primitives"

const LETTERS = "ABCDEFGH"

const SOURCE_LABEL = { locale: "Import PDF locale", ai: "Import PDF con Gemini", manuale: "Inserita a mano" } as const

export function QuestionInfo({ q, sim }: { q: Question; sim?: Simulation }) {
  const rows: [string, string][] = []
  if (q.sourcePdf) rows.push(["PDF", q.sourcePdf])
  if (q.sourceName ?? sim?.name) rows.push(["Prova", (q.sourceName ?? sim?.name)!])
  if (q.page) rows.push(["Pagina", String(q.page)])
  if (q.number) rows.push(["Numero", String(q.number)])
  rows.push(["Origine", q.source ? SOURCE_LABEL[q.source] : "Archivio predefinito"])
  if (q.edited) rows.push(["Modificata", "Sì, a mano"])
  if (q.updatedAt) rows.push(["Aggiornata", new Date(q.updatedAt).toLocaleString("it-IT")])
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
  deletable,
  onSave,
  onDelete,
  onClose,
}: {
  question: Question
  sim?: Simulation
  deletable: boolean
  onSave: (q: Question) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Question>(question)
  const set = (patch: Partial<Question>) => setDraft((d) => ({ ...d, ...patch }))
  const valid = draft.text.trim() && draft.options.length >= 2 && draft.options.every((o) => o.trim())

  const setOption = (i: number, value: string) => set({ options: draft.options.map((o, j) => (j === i ? value : o)) })
  const removeOption = (i: number) =>
    set({
      options: draft.options.filter((_, j) => j !== i),
      correctIndex: draft.correctIndex === i ? -1 : draft.correctIndex > i ? draft.correctIndex - 1 : draft.correctIndex,
    })

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Modifica quesito</h3>
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Testo</span>
        <textarea
          rows={4}
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
                "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-black",
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
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground disabled:opacity-30"
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
        {draft.correctIndex < 0 && <p className="text-xs font-bold text-warning">Nessuna risposta corretta: il quesito non verrà usato nelle prove.</p>}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Materia</span>
        <select
          value={draft.subject}
          onChange={(e) => set({ subject: e.target.value as Question["subject"] })}
          className="rounded-xl border border-border bg-secondary px-3 py-2.5 outline-none focus:border-primary"
        >
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

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
          className="rounded-xl border border-border bg-secondary px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">Spiegazione</span>
        <textarea
          rows={3}
          value={draft.explanation ?? ""}
          onChange={(e) => set({ explanation: e.target.value || undefined })}
          className="rounded-xl border border-border bg-secondary p-2 outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-2">
        {deletable && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Eliminare questo quesito dall'archivio?")) onDelete()
            }}
            className="flex items-center gap-1 rounded-full bg-secondary px-4 font-bold text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            Elimina
          </button>
        )}
        <PrimaryButton
          className="flex-1 px-4 py-3 text-base"
          disabled={!valid}
          onClick={() =>
            onSave({ ...draft, text: draft.text.trim(), options: draft.options.map((o) => o.trim()), edited: true, updatedAt: Date.now() })
          }
        >
          Salva
        </PrimaryButton>
      </div>
    </div>
  )
}
