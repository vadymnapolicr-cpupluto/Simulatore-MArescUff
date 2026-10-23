"use client"

import type { PDFDocumentProxy } from "pdfjs-dist"
import { classifySequence } from "./classify"
import { formatQuestionCode, inferPdfNumber } from "./codes"
import { uid } from "./engine"
import { appendLog, createJob, getJob, patchJob, upsertStep } from "./jobs"
import { bandBox, loadPdf, normalizedToBox, parsePage, renderRegion, unionBox } from "./pdf-local"
import { splitPdf } from "./pdf-split"
import { getPdf, savePdf, updateQuestions, updateSimulations, upsertQuestions } from "./storage"
import type { AiSettings, Question, Simulation, SubjectId } from "./types"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const questionId = (simId: string, n: number) => `${simId}-q${n}`
const letterToIndex = (l: string) => {
  const m = /[A-Fa-f]/.exec(l ?? "")
  return m ? m[0].toUpperCase().charCodeAt(0) - 65 : -1
}

export interface ApiFailure {
  error: string
  raw?: unknown
  status: number
  retryAfterSec?: number
}

async function callApi<T>(url: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; fail: ApiFailure }> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    return { ok: false, fail: { error: "Rete non raggiungibile.", raw: String(e), status: 0 } }
  }
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {}
  if (res.ok && body && typeof body === "object") return { ok: true, data: body as T }
  const b = (typeof body === "object" && body ? body : {}) as Partial<ApiFailure>
  return {
    ok: false,
    fail: {
      error: b.error ?? `Errore HTTP ${res.status}${res.status === 504 ? " (timeout del server: riduci le pagine per blocco)" : ""}`,
      raw: b.raw ?? body,
      status: res.status,
      retryAfterSec: b.retryAfterSec,
    },
  }
}

async function withRetry<T>(
  jobId: string,
  stepId: string,
  label: string,
  settings: AiSettings,
  fn: () => ReturnType<typeof callApi<T>>,
) {
  for (let attempt = 0; ; attempt++) {
    const r = await fn()
    if (r.ok) return r
    const retryable =
      (r.fail.status === 429 && !/GIORNALIERA/.test(r.fail.error)) || r.fail.status === 503 || r.fail.status === 0
    if (!retryable || attempt >= settings.maxRetries || getJob(jobId)?.cancelled) return r
    const wait = Math.min(90, r.fail.retryAfterSec ?? 10 * (attempt + 1))
    appendLog(jobId, "warn", `${label}: ${r.fail.error} (HTTP ${r.fail.status}). Nuovo tentativo tra ${wait}s`, r.fail.raw)
    upsertStep(jobId, {
      id: stepId,
      label,
      status: "in-corso",
      message: `${r.fail.error} Nuovo tentativo tra ${wait}s (${attempt + 1}/${settings.maxRetries})`,
      raw: r.fail.raw,
    })
    await sleep(wait * 1000)
  }
}

export async function createSimulation(
  file: File,
  name: string,
  method: Simulation["method"],
  dedicated = false,
  role = "M" as Simulation["role"],
  pdfIndex?: number,
) {
  const data = await file.arrayBuffer()
  const doc = await loadPdf(data)
  const inferredNum = pdfIndex ?? inferPdfNumber(name.trim() || file.name)
  const sim: Simulation = {
    id: `sim-${uid()}`,
    name: name.trim() || file.name.replace(/\.pdf$/i, ""),
    fileName: file.name,
    role: role ?? "M",
    pdfIndex: inferredNum,
    pageCount: doc.numPages,
    createdAt: Date.now(),
    method,
    dedicated,
  }
  await savePdf(sim.id, file)
  await updateSimulations((prev) => [sim, ...prev])
  return { sim, doc, data }
}

async function openSimPdf(simId: string) {
  const blob = await getPdf(simId)
  if (!blob) throw new Error("PDF della simulazione non trovato sul dispositivo.")
  const data = await blob.arrayBuffer()
  return { data, doc: await loadPdf(data) }
}

export async function runLocalExtraction(sim: Simulation, existingDoc?: PDFDocumentProxy) {
  const job = createJob({ kind: "locale", title: `Scansione locale · ${sim.name}`, simulationId: sim.id, total: sim.pageCount })
  const doc = existingDoc ?? (await openSimPdf(sim.id)).doc
  const found: Question[] = []
  let scannedPages = 0
  const batchId = `batch-${Date.now()}`
  const pdfNum = sim.pdfIndex ?? inferPdfNumber(sim.name)

  for (let p = 1; p <= doc.numPages; p++) {
    if (getJob(job.id)?.cancelled) break
    const stepId = `p${p}`
    upsertStep(job.id, { id: stepId, label: `Pagina ${p}`, status: "in-corso" })
    try {
      const res = await parsePage(doc, p)
      if (res.scanned) scannedPages++
      for (const lq of res.questions) {
        let image: string | undefined
        let imageMissing = false
        if (lq.figures.length) {
          ;[image] = await renderRegion(doc, p, [unionBox(lq.figures)])
        } else if (lq.warnings.some((w) => w.startsWith("Cita una figura"))) {
          ;[image] = await renderRegion(doc, p, [await bandBox(doc, p, lq.band)])
          imageMissing = true
        }
        const code = formatQuestionCode(sim.role ?? "M", pdfNum, lq.number)
        found.push({
          id: questionId(sim.id, lq.number),
          code,
          batchId,
          subject: "logica",
          difficulty: "facile",
          text: lq.text,
          options: lq.options,
          correctIndex: -1,
          image,
          imageMissing,
          simulationId: sim.id,
          number: lq.number,
          page: p,
          band: lq.band,
          source: "locale",
          sourcePdf: sim.fileName,
          sourceName: sim.name,
          updatedAt: Date.now(),
        })
      }
      const warn = res.questions.filter((q) => q.warnings.length)
      upsertStep(job.id, {
        id: stepId,
        label: `Pagina ${p}`,
        status: res.scanned ? "avviso" : warn.length ? "avviso" : "fatto",
        count: res.questions.length,
        message: res.scanned
          ? "Pagina scansionata (senza testo): usa l'estrazione AI"
          : warn.length
            ? `${warn.length} domande da controllare`
            : undefined,
        raw: res.questions.map((q) => ({ n: q.number, testo: q.text, risposte: q.options, avvisi: q.warnings })),
      })
    } catch (e) {
      upsertStep(job.id, { id: stepId, label: `Pagina ${p}`, status: "errore", message: "Lettura pagina fallita", raw: String(e) })
    }
    patchJob(job.id, { done: p })
  }

  const subjects = classifySequence(found)
  found.forEach((q, i) => (q.subject = subjects[i]))
  await mergeIntoSimulation(sim.id, found)
  addSummary(job.id, found, scannedPages)
  patchJob(job.id, { running: false })
  return found
}

function addSummary(jobId: string, qs: Question[], scannedPages = 0) {
  const nums = qs.map((q) => q.number ?? 0).filter(Boolean).sort((a, b) => a - b)
  const missing: number[] = []
  for (let n = 1; n <= (nums.at(-1) ?? 0); n++) if (!nums.includes(n)) missing.push(n)
  upsertStep(jobId, {
    id: "summary",
    label: "Riepilogo",
    status: missing.length || scannedPages ? "avviso" : "fatto",
    count: qs.length,
    message: [
      `${qs.length} domande`,
      missing.length ? `numeri mancanti: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? "..." : ""}` : "",
      scannedPages ? `${scannedPages} pagine senza testo` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  })
}

async function mergeIntoSimulation(simId: string, incoming: Question[]) {
  await updateQuestions((prev) => {
    const map = new Map(prev.map((q) => [q.id, q]))
    for (const q of incoming) {
      const old = map.get(q.id)
      if (!old) map.set(q.id, q)
      else if (old.source === "manuale" || old.edited) continue
      else
        map.set(q.id, {
          ...old,
          ...q,
          code: q.code ?? old.code,
          correctIndex: q.correctIndex >= 0 ? q.correctIndex : old.correctIndex,
          explanation: q.explanation ?? old.explanation,
          image: q.image ?? old.image,
          topic: q.topic ?? old.topic,
        })
    }
    return [...map.values()]
  })
}

interface ExtractedRaw {
  numero: number
  pagina: number
  domanda: string
  risposte: string[]
  corretta: string
  materia: SubjectId
  difficolta: "facile" | "difficile"
  figura: number[] | null
}

export async function runAiExtraction(sim: Simulation, settings: AiSettings, onlyChunks?: number[]) {
  const job = createJob({ kind: "ai-estrai", title: `Estrazione AI · ${sim.name}`, simulationId: sim.id, total: 0 })
  appendLog(job.id, "info", `PDF "${sim.fileName}" · ${sim.pageCount} pagine · modello ${settings.model}`)
  let data: ArrayBuffer, doc: PDFDocumentProxy, chunks: Awaited<ReturnType<typeof splitPdf>>["chunks"]
  try {
    ;({ data, doc } = await openSimPdf(sim.id))
    ;({ chunks } = await splitPdf(data, settings.pagesPerChunk))
  } catch (e) {
    appendLog(job.id, "error", "Impossibile aprire o dividere il PDF", e instanceof Error ? { message: e.message, stack: e.stack } : String(e))
    patchJob(job.id, { running: false })
    return
  }
  const targets = onlyChunks ? chunks.filter((c) => onlyChunks.includes(c.index)) : chunks
  patchJob(job.id, { total: targets.length })
  const all: Question[] = []
  const batchId = `batch-${Date.now()}`
  const pdfNum = sim.pdfIndex ?? settings.pdfNumber ?? inferPdfNumber(sim.name)
  const role = sim.role ?? settings.role ?? "M"

  for (const [i, chunk] of targets.entries()) {
    if (getJob(job.id)?.cancelled) break
    const stepId = `c${chunk.index}`
    const label = `Pagine ${chunk.fromPage}${chunk.toPage !== chunk.fromPage ? `–${chunk.toPage}` : ""}`
    upsertStep(job.id, { id: stepId, label, status: "in-corso" })
    appendLog(job.id, "info", `${label}: invio blocco (${(chunk.bytes.byteLength / 1024).toFixed(0)} KB)...`)
    const t0 = Date.now()

    const r = await withRetry<{ questions: ExtractedRaw[]; meta: unknown }>(job.id, stepId, label, settings, () => {
      const form = new FormData()
      form.append("file", new Blob([chunk.bytes as BlobPart], { type: "application/pdf" }), `p${chunk.fromPage}.pdf`)
      form.append("fromPage", String(chunk.fromPage))
      form.append("toPage", String(chunk.toPage))
      form.append("apiKey", settings.apiKey)
      form.append("model", settings.model)
      form.append("prompt", settings.extractPrompt)
      return callApi("/api/ai/extract", { method: "POST", body: form })
    })

    if (!r.ok) {
      upsertStep(job.id, { id: stepId, label, status: "errore", message: r.fail.error, raw: { status: r.fail.status, ...asObj(r.fail.raw) } })
      appendLog(job.id, "error", `${label}: ${r.fail.error} (HTTP ${r.fail.status})`, { status: r.fail.status, ...asObj(r.fail.raw) })
      if (r.fail.status === 401 || /GIORNALIERA|non valida|Modello non trovato/.test(r.fail.error)) {
        appendLog(job.id, "error", "Errore non recuperabile: importazione interrotta.")
        break
      }
    } else {
      appendLog(job.id, "ok", `${label}: risposta in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${r.data.questions.length} domande`, r.data)
      const qs: Question[] = []
      for (const x of r.data.questions) {
        if (!x.domanda?.trim() || x.risposte.length < 2) continue
        const page = Math.min(chunk.toPage, Math.max(chunk.fromPage, chunk.fromPage + (Number(x.pagina) || 1) - 1))
        let image: string | undefined
        if (x.figura) {
          try {
            const box = await normalizedToBox(doc, page, x.figura)
            if (box) [image] = await renderRegion(doc, page, [box])
          } catch (e) {
            appendLog(job.id, "warn", `Domanda ${x.numero}: ritaglio figura fallito`, String(e))
          }
        }
        const n = Number(x.numero) || all.length + qs.length + 1
        const code = formatQuestionCode(role, pdfNum, n)

        qs.push({
          id: questionId(sim.id, n),
          code,
          batchId,
          subject: x.materia,
          difficulty: x.difficolta,
          text: x.domanda.trim(),
          options: x.risposte.map((o) => o.replace(/^\s*[a-fA-F]\s*[).]\s*/, "").trim()),
          correctIndex: letterToIndex(x.corretta),
          image,
          simulationId: sim.id,
          number: n,
          page,
          source: "ai",
          sourcePdf: sim.fileName,
          sourceName: sim.name,
          updatedAt: Date.now(),
        })
      }
      all.push(...qs)
      await mergeIntoSimulation(sim.id, qs)
      upsertStep(job.id, { id: stepId, label, status: qs.length ? "fatto" : "avviso", count: qs.length, message: qs.length ? undefined : "Nessuna domanda trovata", raw: r.data })
    }
    patchJob(job.id, { done: i + 1 })
    if (i < targets.length - 1) await sleep(settings.delayMs)
  }

  addSummary(job.id, all)
  appendLog(
    job.id,
    getJob(job.id)?.cancelled ? "warn" : "ok",
    `${getJob(job.id)?.cancelled ? "Annullato" : "Completato"}: ${all.length} domande salvate.`,
  )
  patchJob(job.id, { running: false })
}

const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : { body: v })

interface SolutionRaw {
  id: string
  corretta: string
  materia: SubjectId
  difficolta: "facile" | "difficile"
  argomento: string
  spiegazione: string
}

export async function runAiSolve(questions: Question[], settings: AiSettings, title: string, simulationId?: string) {
  const size = Math.max(1, settings.solveBlockSize)
  const blocks: Question[][] = []
  for (let i = 0; i < questions.length; i += size) blocks.push(questions.slice(i, i + size))
  const job = createJob({ kind: "ai-risolvi", title, simulationId, total: blocks.length })
  let solved = 0

  for (const [i, block] of blocks.entries()) {
    if (getJob(job.id)?.cancelled) break
    const stepId = `b${i}`
    const nums = block.map((q) => q.code ?? q.number ?? "?")
    const label = `Domande ${nums[0]}–${nums.at(-1)}`
    upsertStep(job.id, { id: stepId, label, status: "in-corso" })

    const r = await withRetry<{ solutions: SolutionRaw[]; meta: unknown }>(job.id, stepId, label, settings, () =>
      callApi("/api/ai/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          model: settings.model,
          prompt: settings.solvePrompt,
          questions: block.map((q) => ({ id: q.id, text: q.text, options: q.options, image: q.image })),
        }),
      }),
    )

    if (!r.ok) {
      upsertStep(job.id, { id: stepId, label, status: "errore", message: r.fail.error, raw: { status: r.fail.status, ...asObj(r.fail.raw) } })
      if (r.fail.status === 401 || /GIORNALIERA|non valida|Modello non trovato/.test(r.fail.error)) break
    } else {
      const byId = new Map(block.map((q) => [q.id, q]))
      const updates: Question[] = []
      for (const s of r.data.solutions) {
        const q = byId.get(s.id)
        const idx = letterToIndex(s.corretta)
        if (!q || idx < 0 || idx >= q.options.length) continue
        updates.push({
          ...q,
          correctIndex: idx,
          subject: s.materia,
          difficulty: s.difficolta,
          topic: s.argomento,
          explanation: s.spiegazione,
          updatedAt: Date.now(),
        })
      }
      solved += updates.length
      await upsertQuestions(updates)
      const missing = block.length - updates.length
      upsertStep(job.id, {
        id: stepId,
        label,
        status: missing ? "avviso" : "fatto",
        count: updates.length,
        message: missing ? `${missing} senza soluzione valida` : undefined,
        raw: r.data,
      })
    }
    patchJob(job.id, { done: i + 1 })
    if (i < blocks.length - 1) await sleep(settings.delayMs)
  }

  upsertStep(job.id, { id: "summary", label: "Riepilogo", status: solved === questions.length ? "fatto" : "avviso", count: solved, message: `${solved}/${questions.length} risolte` })
  patchJob(job.id, { running: false })
}

export async function deleteSimulation(simId: string, removeQuestions: boolean) {
  await updateSimulations((prev) => prev.filter((s) => s.id !== simId))
  if (removeQuestions) await updateQuestions((prev) => prev.filter((q) => q.simulationId !== simId))
  const { deletePdf } = await import("./storage")
  await deletePdf(simId)
}

export async function downloadSimPdf(sim: Simulation) {
  const blob = await getPdf(sim.id)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = sim.fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}

export async function openSimPdfInTab(sim: Simulation, page?: number) {
  const blob = await getPdf(sim.id)
  if (!blob) return false
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }))
  window.open(page ? `${url}#page=${page}` : url, "_blank", "noopener")
  return true
}

export function exportJson(qs: Question[], fileName: string) {
  const data = qs.map((q) => ({
    codice: q.code,
    numero: q.number,
    materia: q.subject,
    difficolta: q.difficulty,
    argomento: q.topic,
    domanda: q.text,
    risposte: q.options,
    corretta: q.correctIndex >= 0 ? String.fromCharCode(65 + q.correctIndex) : null,
    spiegazione: q.explanation,
    immagine: q.image,
  }))
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = fileName.endsWith(".json") ? fileName : `${fileName}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
