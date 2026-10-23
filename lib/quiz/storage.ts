"use client"

import { useCallback, useSyncExternalStore } from "react"
import { idbDelete, idbGet, idbSet } from "./idb"
import { DEFAULT_SETTINGS } from "./prompts"
import type { AiSettings, Attempt, Question, QuestionProgress, QuizConfig, Simulation } from "./types"

const LEGACY_PREFIX = "gdf-sim:"

const listeners = new Map<string, Set<() => void>>()
const cache = new Map<string, unknown>()
const loading = new Map<string, Promise<unknown>>()
const writeQueue = new Map<string, Promise<unknown>>()

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l())
}

export function loadStore<T>(key: string, fallback: T): Promise<T> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) as T)
  if (!loading.has(key)) {
    loading.set(
      key,
      (async () => {
        let value: T | undefined = await idbGet<T>("kv", key).catch(() => undefined)
        if (value === undefined) {
          const legacy = window.localStorage.getItem(LEGACY_PREFIX + key)
          if (legacy) {
            try {
              value = JSON.parse(legacy) as T
              await idbSet("kv", key, value)
              window.localStorage.removeItem(LEGACY_PREFIX + key)
            } catch {
              value = undefined
            }
          }
        }
        const resolved = value ?? fallback
        cache.set(key, resolved)
        notify(key)
        return resolved
      })(),
    )
  }
  return loading.get(key) as Promise<T>
}

function persist(key: string, value: unknown) {
  const prev = writeQueue.get(key) ?? Promise.resolve()
  const next = prev
    .then(() => idbSet("kv", key, value))
    .catch((e) => console.error("[storage] save failed", key, e))
  writeQueue.set(key, next)
  return next
}

export async function updateStore<T>(key: string, fallback: T, fn: (prev: T) => T) {
  const prev = await loadStore(key, fallback)
  const next = fn((cache.get(key) as T) ?? prev)
  cache.set(key, next)
  notify(key)
  await persist(key, next)
  return next
}

function subscribe(key: string, fallback: unknown, cb: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(cb)
  loadStore(key, fallback)
  return () => {
    listeners.get(key)?.delete(cb)
  }
}

export function usePersistent<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, fallback, cb),
    () => (cache.has(key) ? (cache.get(key) as T) : fallback),
    () => fallback,
  )
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      updateStore(key, fallback, (prev) =>
        typeof next === "function" ? (next as (p: T) => T)(prev) : next,
      )
    },
    [key, fallback],
  )
  return [value, set] as const
}

const EMPTY_QUESTIONS: Question[] = []
const EMPTY_ATTEMPTS: Attempt[] = []
const EMPTY_PROGRESS: Record<string, QuestionProgress> = {}
const EMPTY_SIMULATIONS: Simulation[] = []
const EMPTY_DELETED_SEEDS: string[] = []

export const KEYS = {
  questions: "questions",
  attempts: "attempts",
  progress: "progress",
  lastConfig: "last-config",
  simulations: "simulations",
  settings: "ai-settings",
  deletedSeedIds: "deleted-seed-ids",
} as const

export const useImportedQuestions = () => usePersistent(KEYS.questions, EMPTY_QUESTIONS)
export const useAttempts = () => usePersistent(KEYS.attempts, EMPTY_ATTEMPTS)
export const useProgress = () => usePersistent(KEYS.progress, EMPTY_PROGRESS)
export const useLastConfig = () => usePersistent<QuizConfig | null>(KEYS.lastConfig, null)
export const useSimulations = () => usePersistent(KEYS.simulations, EMPTY_SIMULATIONS)
export const useSettings = () => usePersistent<AiSettings>(KEYS.settings, DEFAULT_SETTINGS)
export const useDeletedSeedIds = () => usePersistent<string[]>(KEYS.deletedSeedIds, EMPTY_DELETED_SEEDS)

export const updateQuestions = (fn: (prev: Question[]) => Question[]) =>
  updateStore(KEYS.questions, EMPTY_QUESTIONS, fn)
export const updateDeletedSeedIds = (fn: (prev: string[]) => string[]) =>
  updateStore(KEYS.deletedSeedIds, EMPTY_DELETED_SEEDS, fn)
export const updateSimulations = (fn: (prev: Simulation[]) => Simulation[]) =>
  updateStore(KEYS.simulations, EMPTY_SIMULATIONS, fn)

export const loadSettings = async (): Promise<AiSettings> => {
  const s = await loadStore<AiSettings>(KEYS.settings, DEFAULT_SETTINGS)
  return { ...DEFAULT_SETTINGS, ...s }
}

export const upsertQuestions = (qs: Question[]) =>
  updateQuestions((prev) => {
    const map = new Map(prev.map((q) => [q.id, q]))
    for (const q of qs) map.set(q.id, { ...map.get(q.id), ...q })
    return [...map.values()]
  })

export const savePdf = (simId: string, file: Blob) => idbSet("files", `pdf:${simId}`, file)
export const getPdf = (simId: string) => idbGet<Blob>("files", `pdf:${simId}`)
export const deletePdf = (simId: string) => idbDelete("files", `pdf:${simId}`)