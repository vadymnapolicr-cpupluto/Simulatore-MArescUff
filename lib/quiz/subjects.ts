import type { QuizConfig, SubjectId } from "./types"

export const SUBJECTS: { id: SubjectId; label: string; short: string }[] = [
  { id: "logica", label: "Abilità logico-matematiche", short: "Logica" },
  { id: "italiano", label: "Lingua italiana", short: "Italiano" },
  { id: "storia", label: "Storia", short: "Storia" },
  { id: "civica", label: "Educazione civica", short: "Civica" },
  { id: "inglese", label: "Inglese", short: "Inglese" },
  { id: "informatica", label: "Informatica", short: "Informatica" },
]

export const SUBJECT_LABEL = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.label])) as Record<
  SubjectId,
  string
>

export const SUBJECT_SHORT = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.short])) as Record<
  SubjectId,
  string
>

export const OFFICIAL_DISTRIBUTION: Record<SubjectId, number> = {
  logica: 35,
  italiano: 25,
  storia: 10,
  civica: 10,
  inglese: 10,
  informatica: 10,
}

export const OFFICIAL_CONFIG: QuizConfig = {
  name: "Simulazione ufficiale GdF",
  official: true,
  subjects: OFFICIAL_DISTRIBUTION,
  difficultyMode: "bilanciato",
  hardPercent: 50,
  pool: "tutte",
  timeMode: "ufficiale",
  totalMinutes: 100,
  secondsPerQuestion: 60,
  scoring: { correctEasy: 1, correctHard: 3, wrong: 0, blank: 0 },
  questionOrder: "casuale",
  answerOrder: "casuale",
  mode: "esame",
  passThreshold: 130,
}

export const PRESETS: { id: string; label: string; description: string; config: QuizConfig }[] = [
  {
    id: "ufficiale",
    label: "Ufficiale",
    description: "100 domande · 100 min · 1/3 punti",
    config: OFFICIAL_CONFIG,
  },
  {
    id: "veloce",
    label: "Allenamento rapido",
    description: "20 domande miste · 20 min",
    config: {
      ...OFFICIAL_CONFIG,
      name: "Allenamento rapido",
      official: false,
      subjects: { logica: 7, italiano: 5, storia: 2, civica: 2, inglese: 2, informatica: 2 },
      timeMode: "personalizzato",
      totalMinutes: 20,
      passThreshold: 26,
    },
  },
  {
    id: "difficili",
    label: "Solo difficili",
    description: "30 domande difficili · 3 punti",
    config: {
      ...OFFICIAL_CONFIG,
      name: "Solo difficili",
      official: false,
      subjects: { logica: 10, italiano: 8, storia: 3, civica: 3, inglese: 3, informatica: 3 },
      difficultyMode: "solo-difficili",
      hardPercent: 100,
      timeMode: "per-domanda",
      secondsPerQuestion: 75,
      passThreshold: 60,
    },
  },
  {
    id: "studio",
    label: "Studio libero",
    description: "Feedback immediato · senza tempo",
    config: {
      ...OFFICIAL_CONFIG,
      name: "Studio libero",
      official: false,
      subjects: { logica: 5, italiano: 5, storia: 2, civica: 2, inglese: 2, informatica: 2 },
      timeMode: "illimitato",
      mode: "esercizio",
      passThreshold: 23,
    },
  },
]
