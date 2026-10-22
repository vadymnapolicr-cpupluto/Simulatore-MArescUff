"use client"

import type { LucideIcon } from "lucide-react"
import { ChevronLeft, Minus, Plus } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function TopBar({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Indietro"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-secondary"
        >
          <ChevronLeft className="size-6" />
        </button>
      ) : (
        <span className="size-11" />
      )}
      <h1 className="truncate text-lg font-extrabold">{title}</h1>
      {right ?? <span className="size-11" />}
    </header>
  )
}

export function Section({
  icon: Icon,
  title,
  description,
  children,
  className,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={cn("rounded-3xl bg-card p-4", className)}>
      <div className="mb-4 flex items-center gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-secondary p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-xl px-2 py-2.5 text-sm font-extrabold transition-colors",
              active ? "bg-muted text-accent-foreground shadow" : "text-secondary-foreground/70",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  tone = "default",
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  tone?: "default" | "success" | "warning" | "destructive"
  suffix?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone]
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-secondary p-1">
      <button
        type="button"
        aria-label={`Diminuisci ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className="flex size-9 items-center justify-center rounded-xl bg-muted disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <label className="flex min-w-12 flex-1 items-baseline justify-center">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isNaN(v)) onChange(clamp(v))
          }}
          className={cn("w-12 bg-transparent text-center text-lg font-black tabular-nums outline-none", toneClass)}
        />
        {suffix && <span className="text-xs font-bold text-muted-foreground">{suffix}</span>}
      </label>
      <button
        type="button"
        aria-label={`Aumenta ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className="flex size-9 items-center justify-center rounded-xl bg-muted disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-[2rem] border border-border bg-secondary/95 px-5 py-3 shadow-2xl backdrop-blur">
        {children}
      </div>
    </div>
  )
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "rounded-full bg-primary px-8 py-3.5 text-lg font-black uppercase tracking-wide text-primary-foreground shadow-[0_0_24px_-4px] shadow-primary/60 transition active:scale-95 disabled:opacity-40 disabled:shadow-none",
        className,
      )}
    >
      {children}
    </button>
  )
}
