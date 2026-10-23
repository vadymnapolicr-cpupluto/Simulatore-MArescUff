"use client"

import { Check, ChevronLeft, ChevronRight, Flag, LayoutGrid, Pause, SplitSquareHorizontal, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDuration, timeLimitMs } from "@/lib/quiz/engine"
import { SUBJECT_LABEL } from "@/lib/quiz/subjects"
import type { AnswerState, Question, QuizSession } from "@/lib/quiz/types"
import { cn } from "@/lib/utils"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

const emptyAnswer = (): AnswerState => ({ selected: null, candidates: [], doubt: false, timeSpentMs: 0 })

export function QuizRunner({
  session,
  bankById,
  onFinish,
  onCancel,
}: {
  session: QuizSession
  bankById: Map<string, Question>
  onFinish: (answers: Record<string, AnswerState>, durationMs: number) => void
  onCancel: () => void
}) {
  const questions = useMemo(
    () =>
      session.questions
        .map((sq) => ({ sq, q: bankById.get(sq.questionId) }))
        .filter((x): x is { sq: (typeof session.questions)[number]; q: Question } => !!x.q),
    [session, bankById],
  )
  const total = questions.length
  const limit = timeLimitMs(session.config, total)
  const exercise = session.config.mode === "esercizio"

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [paused, setPaused] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [candidateMode, setCandidateMode] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const elapsedRef = useRef(0)
  const lastTickRef = useRef<number | null>(null)
  const questionStartRef = useRef(0)
  const finishedRef = useRef(false)

  const current = questions[index]
  const currentAnswer = answers[current?.q.id] ?? emptyAnswer()

  const commitQuestionTime = useCallback(() => {
    if (!current) return
    const spent = elapsedRef.current - questionStartRef.current
    questionStartRef.current = elapsedRef.current
    if (spent <= 0) return
    setAnswers((prev) => {
      const a = prev[current.q.id] ?? emptyAnswer()
      return { ...prev, [current.q.id]: { ...a, timeSpentMs: a.timeSpentMs + spent } }
    })
  }, [current])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const spent = elapsedRef.current - questionStartRef.current
    const final = { ...answers }
    if (current) {
      const a = final[current.q.id] ?? emptyAnswer()
      final[current.q.id] = { ...a, timeSpentMs: a.timeSpentMs + Math.max(0, spent) }
    }
    onFinish(final, elapsedRef.current)
  }, [answers, current, onFinish])

  useEffect(() => {
    if (paused) {
      lastTickRef.current = null
      return
    }
    lastTickRef.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      elapsedRef.current += now - (lastTickRef.current ?? now)
      lastTickRef.current = now
      setElapsed(elapsedRef.current)
    }, 250)
    return () => window.clearInterval(id)
  }, [paused])

  const remaining = limit === null ? null : Math.max(0, limit - elapsed)

  useEffect(() => {
    if (remaining === 0) finish()
  }, [remaining, finish])

  const goTo = (i: number) => {
    if (i < 0 || i >= total) return
    commitQuestionTime()
    setIndex(i)
    setCandidateMode(false)
    setGridOpen(false)
  }

  const patchAnswer = (patch: Partial<AnswerState>) => {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.q.id]: { ...(prev[current.q.id] ?? emptyAnswer()), ...patch } }))
  }

  const locked = exercise && currentAnswer.selected !== null

  const onOption = (originalIndex: number) => {
    if (locked) return
    if (candidateMode) {
      const has = currentAnswer.candidates.includes(originalIndex)
      patchAnswer({
        candidates: has
          ? currentAnswer.candidates.filter((c) => c !== originalIndex)
          : [...currentAnswer.candidates, originalIndex],
      })
      return
    }
    patchAnswer({ selected: currentAnswer.selected === originalIndex ? null : originalIndex })
  }

  const answeredCount = questions.filter(({ q }) => answers[q.id]?.selected != null).length
  const lowTime = remaining !== null && remaining < 5 * 60_000

  if (!current) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-bold">Nessuna domanda disponibile con questi filtri.</p>
        <button type="button" onClick={onCancel} className="rounded-full bg-muted px-6 py-3 font-extrabold">
          Torna indietro
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-36">
      <header className="sticky top-0 z-20 bg-background/90 px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPaused(true)}
            className="rounded-full bg-secondary px-6 py-3 text-lg font-black text-destructive"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-black text-primary-foreground shadow-[0_0_24px_-6px] shadow-primary/70"
          >
            <Check className="size-5" strokeWidth={3} aria-hidden />
            Consegna
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-3 px-3">
        <section className="rounded-3xl bg-[#171a3a] p-5" aria-label="Avanzamento">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                {remaining === null ? "Tempo trascorso" : "Tempo rimanente"}
              </p>
              <p
                className={cn("text-4xl font-black tabular-nums", lowTime && "text-destructive")}
                aria-live={lowTime ? "polite" : "off"}
              >
                {formatDuration(remaining ?? elapsed)}
              </p>
            </div>
            <span className="flex max-w-[50%] items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-extrabold uppercase leading-tight">
              <span
                className={cn("size-2 shrink-0 rounded-full", current.q.difficulty === "difficile" ? "bg-warning" : "bg-success")}
                aria-hidden
              />
              {SUBJECT_LABEL[current.q.subject]}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(answeredCount / total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-black tabular-nums">
              {answeredCount} / {total}
            </span>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setGridOpen(true)}
          className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3 text-left"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-[#8ea2e8]">
            <LayoutGrid className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-black">
              Domanda {index + 1} <span className="text-muted-foreground">di {total}</span>
            </span>
            <span className="block text-sm font-semibold text-muted-foreground">
              {current.q.difficulty === "difficile"
                ? `Difficile · ${session.config.scoring.correctHard} pt`
                : `Facile · ${session.config.scoring.correctEasy} pt`}{" "}
              · tocca per la griglia
            </span>
          </span>
          <ChevronRight className="size-5 text-primary" aria-hidden />
        </button>

        {current.q.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.q.image} alt="Immagine della domanda" className="mx-auto max-h-64 rounded-xl bg-white" />
        )}

        <div className="flex gap-3 px-1 py-2">
          <span className="text-2xl font-black text-primary">{index + 1}.</span>
          <div className="flex-1">
            {current.q.code && (
              <span className="mb-1 inline-block rounded-md bg-primary/20 px-2 py-0.5 font-mono text-xs font-black text-primary">
                {current.q.code}
              </span>
            )}
            <p className="text-pretty text-lg font-bold leading-snug text-secondary-foreground">{current.q.text}</p>
            {current.q.sourcePdf && (
              <p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">
                {current.q.sourcePdf}
                {current.q.page ? ` · p. ${current.q.page}` : ""}
                {current.q.number ? ` · n. ${current.q.number}` : ""}
              </p>
            )}
          </div>
        </div>

        {candidateMode && (
          <p className="rounded-xl bg-warning/10 px-3 py-2 text-sm font-bold text-warning" role="status">
            Modalità indecisione: tocca le opzioni tra cui sei indeciso.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {current.sq.optionOrder.map((orig, pos) => {
            const selected = currentAnswer.selected === orig
            const candidate = currentAnswer.candidates.includes(orig)
            const reveal = locked
            const isCorrect = orig === current.q.correctIndex
            return (
              <li key={orig}>
                <button
                  type="button"
                  onClick={() => onOption(orig)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-3xl border-2 bg-card p-4 text-left transition-colors",
                    selected && !reveal && "border-primary bg-accent",
                    !selected && "border-border",
                    candidate && !selected && "border-dashed border-warning",
                    reveal && isCorrect && "border-success bg-success/15",
                    reveal && selected && !isCorrect && "border-destructive bg-destructive/15",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-black",
                      selected && "bg-primary text-primary-foreground",
                      candidate && !selected && "bg-warning/20 text-warning",
                    )}
                  >
                    {LETTERS[pos]}
                  </span>
                  <span className="flex-1 text-lg font-bold text-secondary-foreground">{current.q.options[orig]}</span>
                  {reveal && isCorrect && <Check className="size-5 text-success" aria-label="Corretta" />}
                  {reveal && selected && !isCorrect && <X className="size-5 text-destructive" aria-label="Errata" />}
                </button>
              </li>
            )
          })}
        </ul>

        {locked && current.q.explanation && (
          <div className="rounded-2xl bg-card p-4">
            <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Spiegazione</p>
            <p className="text-secondary-foreground">{current.q.explanation}</p>
          </div>
        )}
      </main>

      <nav
        aria-label="Navigazione domande"
        className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 rounded-[2rem] border border-border bg-secondary/95 p-2 backdrop-blur">
          <NavButton label="Precedente" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft className="size-6" />
          </NavButton>
          <NavButton
            label={currentAnswer.doubt ? "Rimuovi dubbio" : "Segna in dubbio"}
            onClick={() => patchAnswer({ doubt: !currentAnswer.doubt })}
            active={currentAnswer.doubt}
          >
            <Flag className="size-5" />
          </NavButton>
          <NavButton label="Pausa" onClick={() => setPaused(true)}>
            <Pause className="size-5" />
          </NavButton>
          <NavButton
            label={candidateMode ? "Esci da indecisione" : "Segna indecisione"}
            onClick={() => setCandidateMode((v) => !v)}
            active={candidateMode}
            disabled={locked}
          >
            <SplitSquareHorizontal className="size-5" />
          </NavButton>
          <NavButton
            label={index === total - 1 ? "Consegna" : "Successiva"}
            onClick={() => (index === total - 1 ? setConfirmOpen(true) : goTo(index + 1))}
            primary
          >
            {index === total - 1 ? <Check className="size-6" /> : <ChevronRight className="size-6" />}
          </NavButton>
        </div>
      </nav>

      {gridOpen && (
        <Overlay onClose={() => setGridOpen(false)} label="Griglia domande">
          <h2 className="mb-1 text-lg font-black">Griglia domande</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {answeredCount} risposte · {total - answeredCount} da fare
          </p>
          <div className="grid max-h-[50vh] grid-cols-6 gap-2 overflow-y-auto">
            {questions.map(({ q }, i) => {
              const a = answers[q.id]
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Domanda ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-xl bg-secondary text-sm font-black tabular-nums",
                    a?.selected != null && "bg-primary text-primary-foreground",
                    i === index && "ring-2 ring-foreground",
                  )}
                >
                  {i + 1}
                  {a?.doubt && <span className="absolute right-1 top-1 size-2 rounded-full bg-warning" aria-hidden />}
                </button>
              )
            })}
          </div>
        </Overlay>
      )}

      {paused && (
        <Overlay label="Simulazione in pausa">
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-[#171a3a]">
              <Pause className="size-8" fill="currentColor" aria-hidden />
            </span>
            <h2 className="text-2xl font-black text-secondary-foreground">Simulazione in pausa</h2>
            <p className="mt-1 text-muted-foreground">Il cronometro è fermo. Riprendi quando sei pronto a continuare.</p>
            <p className="my-5 text-4xl font-black tabular-nums text-[#8ea2e8]">
              {formatDuration(remaining ?? elapsed)}
            </p>
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-primary-foreground"
            >
              Riprendi
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 rounded-full bg-muted px-8 py-3 font-black text-destructive"
            >
              Esci dalla simulazione
            </button>
          </div>
        </Overlay>
      )}

      {confirmOpen && (
        <Overlay onClose={() => setConfirmOpen(false)} label="Conferma consegna">
          <h2 className="text-xl font-black">Consegnare la prova?</h2>
          <p className="mt-2 text-muted-foreground">
            Hai risposto a {answeredCount} domande su {total}.
            {total - answeredCount > 0 && ` ${total - answeredCount} risultano non date.`}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="flex-1 rounded-2xl bg-muted py-3 font-black"
            >
              Continua
            </button>
            <button
              type="button"
              onClick={finish}
              className="flex-1 rounded-2xl bg-primary py-3 font-black text-primary-foreground"
            >
              Consegna
            </button>
          </div>
        </Overlay>
      )}
    </div>
  )
}

function NavButton({
  children,
  label,
  onClick,
  disabled,
  active,
  primary,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex size-14 items-center justify-center rounded-full bg-muted text-secondary-foreground transition active:scale-95 disabled:opacity-30",
        active && "bg-warning/20 text-warning",
        primary && "bg-primary text-primary-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Overlay({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode
  onClose?: () => void
  label: string
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}