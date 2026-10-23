"use client"

import { FileJson, FileUp, Trash2 } from "lucide-react"
import { useState } from "react"
import { JSON_EXAMPLE, TXT_EXAMPLE, parseQuestions } from "@/lib/quiz/import"
import { SUBJECTS } from "@/lib/quiz/subjects"
import type { Question } from "@/lib/quiz/types"
import { PdfImport } from "./pdf-import"
import { PrimaryButton, Section, Segmented, TopBar } from "./primitives"

export function ImportScreen({
  imported,
  onImport,
  onClear,
  onBack,
}: {
  imported: Question[]
  onImport: (qs: Question[]) => void
  onClear: () => void
  onBack: () => void
}) {
  const [text, setText] = useState("")
  const [format, setFormat] = useState<"json" | "txt">("json")
  const [message, setMessage] = useState<{ ok: boolean; text: string; errors: string[] } | null>(null)

  const run = (input: string) => {
    const { questions, errors } = parseQuestions(input)
    if (questions.length) onImport(questions)
    setMessage({
      ok: questions.length > 0,
      text: questions.length ? `${questions.length} domande importate con successo!` : "Nessuna domanda valida trovata.",
      errors: errors.slice(0, 5),
    })
    if (questions.length) setText("")
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    run(await file.text())
  }

  return (
    <div className="min-h-dvh pb-10">
      <TopBar title="Importa domande" onBack={onBack} />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-3 pt-4">
        <PdfImport />

        <Section icon={FileUp} title="Incolla o carica un file (JSON / Backup)">
          <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-5 text-center font-bold text-muted-foreground transition hover:border-primary">
            <div className="flex items-center gap-2 text-primary">
              <FileJson className="size-6" />
              <span className="text-sm font-black">Carica file JSON esportato o backup</span>
            </div>
            <span className="text-xs text-muted-foreground">Supporta file .json esportati dall&apos;Archivio o file di testo .txt</span>
            <input
              type="file"
              accept=".json,.txt,application/json,text/plain"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>

          <label htmlFor="import-text" className="sr-only">
            Testo da importare
          </label>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Incolla qui JSON o testo generato..."
            className="w-full rounded-2xl border border-border bg-secondary p-3 font-mono text-sm outline-none focus:border-primary"
          />
          <PrimaryButton className="mt-3 w-full" disabled={!text.trim()} onClick={() => run(text)}>
            Importa contenuto
          </PrimaryButton>

          {message && (
            <div role="status" className="mt-3 text-sm">
              <p className={message.ok ? "font-bold text-success" : "font-bold text-destructive"}>{message.text}</p>
              {message.errors.map((e) => (
                <p key={e} className="text-xs text-muted-foreground">
                  {e}
                </p>
              ))}
            </div>
          )}
        </Section>

        <Section title="Formato supportato">
          <Segmented
            label="Formato esempio"
            value={format}
            onChange={setFormat}
            options={[
              { value: "json", label: "JSON (Completo)" },
              { value: "txt", label: "Testo rapido" },
            ]}
          />
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-secondary p-3 text-xs leading-relaxed text-secondary-foreground font-mono">
            {format === "json" ? JSON_EXAMPLE : TXT_EXAMPLE}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            I file JSON esportati dall&apos;Archivio preservano automaticamente codici concorso (es. M05N67), materia, livello, spiegazioni e soluzioni.
          </p>
        </Section>

        <Section title="Riepilogo domande caricate">
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {SUBJECTS.map((s) => (
              <li key={s.id} className="flex justify-between rounded-xl bg-secondary px-3 py-2">
                <span className="font-bold">{s.short}</span>
                <span className="tabular-nums text-muted-foreground">
                  {imported.filter((q) => q.subject === s.id).length}
                </span>
              </li>
            ))}
          </ul>
          {imported.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3 font-bold text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Rimuovi {imported.length} domande importate
            </button>
          )}
        </Section>
      </main>
    </div>
  )
}