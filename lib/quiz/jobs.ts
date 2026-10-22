"use client"

import { useSyncExternalStore } from "react"

export type StepStatus = "attesa" | "in-corso" | "fatto" | "errore" | "avviso"

export interface JobStep {
  id: string
  label: string
  status: StepStatus
  message?: string
  /** Raw response from the API (or local parser) for debugging. */
  raw?: unknown
  count?: number
}

export type LogLevel = "info" | "ok" | "warn" | "error"

export interface LogEntry {
  t: number
  level: LogLevel
  text: string
  raw?: unknown
}

export interface Job {
  id: string
  kind: "locale" | "ai-estrai" | "ai-risolvi"
  title: string
  simulationId?: string
  running: boolean
  cancelled: boolean
  done: number
  total: number
  steps: JobStep[]
  log: LogEntry[]
  startedAt: number
}

let jobs: Job[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function createJob(init: Omit<Job, "id" | "running" | "cancelled" | "done" | "steps" | "log" | "startedAt">): Job {
  const job: Job = { ...init, id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, running: true, cancelled: false, done: 0, steps: [], log: [], startedAt: Date.now() }
  jobs = [job, ...jobs].slice(0, 10)
  emit()
  return job
}

export function appendLog(jobId: string, level: LogLevel, text: string, raw?: unknown) {
  jobs = jobs.map((j) => (j.id === jobId ? { ...j, log: [...j.log, { t: Date.now(), level, text, raw }] } : j))
  emit()
}

/** Plain-text dump of the whole job, including every raw payload, for copy/download. */
export function jobToText(job: Job) {
  const time = (t: number) => new Date(t).toLocaleTimeString("it-IT")
  const lines = [`# ${job.title}`, `Avviato: ${new Date(job.startedAt).toLocaleString("it-IT")}`, `Avanzamento: ${job.done}/${job.total}`, ""]
  for (const e of job.log) {
    lines.push(`[${time(e.t)}] ${e.level.toUpperCase()} ${e.text}`)
    if (e.raw !== undefined) lines.push(typeof e.raw === "string" ? e.raw : JSON.stringify(e.raw, null, 2))
  }
  return lines.join("\n")
}

export function patchJob(id: string, patch: Partial<Job>) {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j))
  emit()
}

export function upsertStep(jobId: string, step: JobStep) {
  jobs = jobs.map((j) => {
    if (j.id !== jobId) return j
    const exists = j.steps.some((s) => s.id === step.id)
    return {
      ...j,
      steps: exists ? j.steps.map((s) => (s.id === step.id ? { ...s, ...step } : s)) : [...j.steps, step],
    }
  })
  emit()
}

export const getJob = (id: string) => jobs.find((j) => j.id === id)
export const cancelJob = (id: string) => patchJob(id, { cancelled: true })
export const clearFinishedJobs = () => {
  jobs = jobs.filter((j) => j.running)
  emit()
}

export function useJobs() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => jobs,
    () => jobs,
  )
}
