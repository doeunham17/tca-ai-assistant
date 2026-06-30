"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Ban,
  Heart,
  ChevronDown,
  TriangleAlert,
  Stethoscope,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { StructuredReport } from "@/lib/tca/engine"

const CAT_ACCENT: Record<string, string> = {
  GATE: "border-l-destructive",
  CAUTION: "border-l-amber-500",
  IMMEDIATE: "border-l-destructive",
  AIRWAY: "border-l-primary",
  BREATHING: "border-l-primary",
  CIRCULATION: "border-l-primary",
  PROCEDURE: "border-l-primary",
  DRUGS: "border-l-primary",
  NEURO: "border-l-primary",
  POPULATION: "border-l-primary",
  DIAGNOSTIC: "border-l-muted-foreground",
  DISPOSITION: "border-l-muted-foreground",
}

const CONFIDENCE_STYLE: Record<string, string> = {
  High: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
  Moderate: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  Low: "bg-muted text-muted-foreground ring-border",
}

function StateChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-destructive" : "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      {label}
    </span>
  )
}

function DisclosureButton({
  open,
  onClick,
  icon,
  label,
}: {
  open: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      {icon}
      {label}
      <ChevronDown
        className={cn("size-3.5 transition-transform", open && "rotate-180")}
        aria-hidden
      />
    </button>
  )
}

export function TcaReport({ report }: { report: StructuredReport }) {
  const [showReasoning, setShowReasoning] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)
  const { emt } = report
  const s = report.derivedState

  const reasoningText = emt.primaryCause
    ? `Findings are most consistent with ${emt.primaryCause.name.toLowerCase()} (${emt.primaryCause.confidencePct}%).`
    : "No single dominant reversible cause identified from the facts provided — treat empirically and reassess."

  return (
    <div className="not-prose my-2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      {/* ===================== LEVEL 1 — EMT MODE ===================== */}
      <div className="border-b-4 border-destructive bg-destructive/5 px-4 py-2">
        <p className="text-xs font-bold uppercase tracking-widest text-destructive">
          {emt.headline}
        </p>
      </div>

      {emt.withhold && (
        <div className="flex items-start gap-2 border-b border-border bg-destructive/10 px-4 py-3">
          <Ban className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">
            WITHHOLD / TERMINATE criteria met — do not start active
            interventions. Confirm with medical direction.
          </p>
        </div>
      )}

      {/* Most likely cause */}
      {!emt.withhold && (
        <div className="flex items-end justify-between gap-3 px-4 pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Most likely cause
            </p>
            <p className="text-xl font-bold leading-tight text-foreground text-balance">
              {emt.primaryCause ? emt.primaryCause.name : "Undifferentiated"}
            </p>
          </div>
          {emt.primaryCause && (
            <span className="shrink-0 text-3xl font-bold tabular-nums text-destructive">
              {emt.primaryCause.confidencePct}%
            </span>
          )}
        </div>
      )}

      {/* Immediate actions */}
      <div className="px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Immediate actions
        </p>
        {emt.immediateActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions triggered — provide more findings (mechanism, vitals,
            setting, capability).
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {emt.immediateActions.map((action, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium leading-relaxed text-foreground">
                  {action}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Secondary concerns + disposition + confidence */}
      <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Secondary concerns
          </p>
          {emt.secondaryConcerns.length ? (
            <ul className="mt-1 flex flex-col gap-0.5">
              {emt.secondaryConcerns.map((c) => (
                <li key={c} className="text-sm text-foreground">
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">None ranked.</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Confidence
          </p>
          <span
            className={cn(
              "mt-1 inline-flex rounded-md px-2.5 py-1 text-sm font-bold ring-1",
              CONFIDENCE_STYLE[emt.confidence],
            )}
          >
            {emt.confidence}
          </span>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Disposition
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
          {emt.disposition}
        </p>
      </div>

      {/* Disclosure controls */}
      <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-4 py-3">
        <DisclosureButton
          open={showReasoning}
          onClick={() => setShowReasoning((v) => !v)}
          icon={<Stethoscope className="size-3.5" aria-hidden />}
          label="Why?"
        />
        <DisclosureButton
          open={showEvidence}
          onClick={() => setShowEvidence((v) => !v)}
          icon={<BookOpen className="size-3.5" aria-hidden />}
          label="Evidence"
        />
      </div>

      {/* ===================== LEVEL 2 — CLINICAL REASONING ===================== */}
      {showReasoning && (
        <section className="border-t border-border px-4 py-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            Clinical reasoning
          </h4>
          <p className="mb-3 text-sm leading-relaxed text-foreground">
            {reasoningText}
          </p>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Physiological state
          </p>
          <div className="flex flex-wrap gap-2">
            <StateChip label="TCA" active={s.tca} />
            <StateChip label="Peri-arrest" active={s.peri_arrest} />
            <StateChip label="Haemorrhagic shock" active={s.hemorrhagic_shock} />
            <StateChip label="Pseudo-PEA" active={s.pseudo_pea} />
            <StateChip label="Signs of life" active={s.signs_of_life} />
          </div>
        </section>
      )}

      {/* ===================== LEVEL 3 — EVIDENCE MODE ===================== */}
      {showEvidence && (
        <section className="border-t border-border px-4 py-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
            Evidence &amp; triggered rules ({report.ruleCount})
          </h4>
          {report.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules fired.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {report.groups.map((g) => (
                <div key={g.cat}>
                  <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </h5>
                  <ul className="flex flex-col gap-2.5">
                    {g.rules.map((r) => (
                      <li
                        key={r.id}
                        className={cn(
                          "border-l-2 pl-3",
                          CAT_ACCENT[g.cat] ?? "border-l-border",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[11px] font-medium text-foreground">
                            {r.id}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                            P{r.priority}
                          </span>
                          {r.divergence && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:text-amber-500">
                              <TriangleAlert className="size-3" aria-hidden />
                              divergence
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {r.text}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {r.sources.join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {report.divergences.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-500/5 p-3">
              <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                <AlertTriangle className="size-3.5" aria-hidden />
                Inter-guideline divergences
              </h5>
              <div className="flex flex-col gap-3">
                {report.divergences.map((d) => (
                  <div key={d.id} className="text-sm">
                    <p className="font-medium text-foreground">
                      {d.id} — {d.topic}
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {Object.entries(d.positions).map(([src, stance]) => (
                        <li key={src} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {src}:
                          </span>{" "}
                          {stance}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">
                      <span className="font-semibold text-primary">
                        Default resolution:
                      </span>{" "}
                      <span className="text-foreground">
                        {d.defaultResolution}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <Heart className="size-3" aria-hidden />
        Decision support only — verify against local protocols &amp; medical
        direction.
      </div>
    </div>
  )
}
