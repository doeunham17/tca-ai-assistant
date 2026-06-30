// Unified TCA Expert System — INFERENCE ENGINE (TypeScript port)
// Forward-chaining rule engine over the merged six-guideline knowledge base.
// Decision support only — expert-consensus / observational evidence, no TCA RCTs.

import {
  RULES,
  CONFLICTS,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  type Rule,
  type Category,
} from "./knowledge-base"

export type FactValue = string | number | boolean | null

export type Facts = Record<string, FactValue>

// Hard "do not start" gates: if either fires, active-treatment rules are moot
const WITHHOLD_GATES = new Set(["G03-WITHHOLD", "G04-WITHHOLD-NAEMSP"])

// --------------------------------------------------------------------------
// DERIVATION — compute secondary facts before rule evaluation
// --------------------------------------------------------------------------
export function derive(facts: Facts): Facts {
  const f: Facts = { ...facts }
  const trauma = f.trauma === true
  const resp = f.responsive
  const pulse = f.pulse

  f.in_arrest = pulse === "absent"
  f.peri_arrest = trauma && pulse === "weak"
  f.tca = trauma && resp === false && pulse === "absent"

  if (!("signs_of_life" in facts) || facts.signs_of_life == null) {
    f.signs_of_life = Boolean(
      resp === true ||
        pulse === "present" ||
        pulse === "weak" ||
        f.cardiac_motion === "present",
    )
  }

  const hv = f.hypovolemia === "suspected" || f.hypovolemia === "confirmed"
  f.hemorrhagic_shock = Boolean(
    hv && (pulse === "weak" || pulse === "absent" || resp === false),
  )

  f.pseudo_pea = Boolean(
    (f.rhythm === "pea" || f.rhythm === "organized") &&
      f.cardiac_motion === "present",
  )
  return f
}

// --------------------------------------------------------------------------
// CONDITION EVALUATOR
// --------------------------------------------------------------------------
type Cond = Record<string, unknown>

export function evalCond(cond: Cond, f: Facts): boolean {
  if ("all" in cond) return (cond.all as Cond[]).every((c) => evalCond(c, f))
  if ("any" in cond) return (cond.any as Cond[]).some((c) => evalCond(c, f))
  if ("not" in cond) return !evalCond(cond.not as Cond, f)

  const fact = cond.fact as string
  const op = cond.op as string
  const val = cond.val
  const cur = f[fact]

  switch (op) {
    case "eq":
      return cur === val
    case "ne":
      return cur != null && cur !== val
    case "in":
      return (val as FactValue[]).includes(cur as FactValue)
    case "nin":
      return cur != null && !(val as FactValue[]).includes(cur as FactValue)
    case "gte":
    case "lte":
    case "gt":
    case "lt": {
      if (typeof cur !== "number") return false
      const v = val as number
      if (op === "gte") return cur >= v
      if (op === "lte") return cur <= v
      if (op === "gt") return cur > v
      return cur < v
    }
    default:
      return false
  }
}

// --------------------------------------------------------------------------
// INFERENCE
// --------------------------------------------------------------------------
export interface InferenceResult {
  derived: Facts
  fired: Rule[]
  withheld: boolean
}

export function infer(facts: Facts): InferenceResult {
  const derived = derive(facts)
  let fired = RULES.filter((r) => evalCond(r.when, derived))
  const withheld = fired.some((r) => WITHHOLD_GATES.has(r.id))
  if (withheld) {
    // keep only the triage/safety gate, drop interventions
    fired = fired.filter((r) => r.cat === "GATE")
  }
  fired.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.cat)
    const cb = CATEGORY_ORDER.indexOf(b.cat)
    if (ca !== cb) return ca - cb
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.id.localeCompare(b.id)
  })
  return { derived, fired, withheld }
}

// --------------------------------------------------------------------------
// STRUCTURED REPORT (for the model + UI to consume)
// --------------------------------------------------------------------------
export interface ReportGroup {
  cat: Category
  label: string
  rules: {
    id: string
    priority: number
    text: string
    sources: string[]
    divergence: string | null
  }[]
}

export interface DivergenceEntry {
  id: string
  topic: string
  positions: Record<string, string>
  defaultResolution: string
}

// LEVEL 1 — EMT-facing summary (the default, "read in <5s" view)
export interface EmtSummary {
  headline: string
  primaryCause: { name: string; confidencePct: number } | null
  immediateActions: string[]
  secondaryConcerns: string[]
  disposition: string
  confidence: "Low" | "Moderate" | "High"
  withhold: boolean
}

export interface StructuredReport {
  emt: EmtSummary
  derivedState: {
    tca: boolean
    peri_arrest: boolean
    hemorrhagic_shock: boolean
    pseudo_pea: boolean
    signs_of_life: boolean
    in_arrest: boolean
  }
  withheld: boolean
  groups: ReportGroup[]
  divergences: DivergenceEntry[]
  ruleCount: number
}

// --------------------------------------------------------------------------
// CAUSE RANKING — deterministic scoring of reversible/likely causes
// --------------------------------------------------------------------------
function scoreStatus(v: FactValue): number {
  if (v === "confirmed") return 0.9
  if (v === "suspected") return 0.6
  return 0
}

function computeCauses(f: Facts): { name: string; confidencePct: number }[] {
  const causes: { name: string; score: number }[] = []

  // Tension pneumothorax
  {
    let s = scoreStatus(f.tension_pneumothorax)
    if (f.chest_injury === "blunt" || f.chest_injury === "penetrating") s += 0.05
    if (f.ppv === "active") s += 0.08
    if (f.open_chest_wound === true) s += 0.05
    if (s > 0) causes.push({ name: "Tension pneumothorax", score: s })
  }
  // Cardiac tamponade
  {
    let s = scoreStatus(f.tamponade)
    if (f.chest_injury === "penetrating") s += 0.08
    if (s > 0) causes.push({ name: "Cardiac tamponade", score: s })
  }
  // Haemorrhage / hypovolaemia
  {
    let s = scoreStatus(f.hypovolemia)
    if (f.external_hemorrhage === true) s += 0.08
    if (f.noncompressible_torso_hemorrhage === true) s += 0.08
    if (f.pelvic_fracture_suspected === true) s += 0.05
    if (f.major_amputation === true) s += 0.05
    if (f.mechanism === "penetrating" || f.mechanism === "blast") s += 0.04
    if (f.hemorrhagic_shock === true) s += 0.05
    if (s > 0) causes.push({ name: "Haemorrhage / hypovolaemia", score: s })
  }
  // Hypoxia / airway obstruction
  {
    let s = 0
    if (f.asphyxia === true) s += 0.7
    if (f.airway_obstruction_unmanageable === true) s += 0.2
    if (s > 0) causes.push({ name: "Hypoxia / airway obstruction", score: s })
  }
  // Primary medical cause
  {
    if (f.suspected_medical_cause === true)
      causes.push({ name: "Primary medical cause", score: 0.6 })
  }

  return causes
    .map((c) => ({
      name: c.name,
      confidencePct: Math.min(97, Math.round(c.score * 100)),
    }))
    .filter((c) => c.confidencePct > 0)
    .sort((a, b) => b.confidencePct - a.confidencePct)
}

const EMT_ACTION_CATS = new Set<Category>([
  "GATE",
  "IMMEDIATE",
  "BREATHING",
  "CIRCULATION",
  "AIRWAY",
  "PROCEDURE",
  "DRUGS",
])

// Phrases/terms that belong ONLY in Evidence mode (Level 3) and must never
// appear in the Level-1 EMT action view.
const FORBIDDEN_EMT = /(empty heart|\b(survival|retrospective|evidence|dogma|RCT|outcomes? improved|controvers|literature|associated with|futility|minority position|narrative review|adrenaline|epinephrine|ATLS)\b)/i

// Convert a verbose rule.then into a single crisp imperative for Level 1.
// Strips leading slogans, rationale trailers, parentheticals, and any
// sentence containing forbidden (evidence-mode) terminology.
function toEmtAction(text: string): string {
  let t = text.trim()
  // Drop a leading quoted slogan + dash (e.g. "'Don't pump an empty heart' — ")
  t = t.replace(/^['"][^'"]{0,60}['"]\s*[—–-]+\s*/, "")
  // Keep only the first sentence (actions should be one line).
  const firstStop = t.search(/\.\s/)
  if (firstStop > 0) t = t.slice(0, firstStop)
  // Cut the rationale trailer after an em/en dash.
  const dash = t.search(/\s[—–]\s/)
  if (dash > 0) t = t.slice(0, dash)
  // Remove parenthetical asides.
  t = t.replace(/\s*\([^)]*\)/g, "")
  // Tidy whitespace/punctuation.
  t = t.replace(/\s{2,}/g, " ").replace(/[;,]\s*$/, "").trim()
  return t
}

function sanitizeDisposition(text: string): string {
  // Keep only sentences free of forbidden evidence-mode terms.
  const kept = text
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\s*\([^)]*\)/g, "").trim())
    .filter((s) => s && !FORBIDDEN_EMT.test(s))
  return kept.join(" ").replace(/\s{2,}/g, " ").trim()
}

function buildEmtSummary(
  derived: Facts,
  fired: Rule[],
  withheld: boolean,
): EmtSummary {
  const headline = derived.tca
    ? "TRAUMATIC CARDIAC ARREST"
    : derived.peri_arrest
      ? "TRAUMATIC PERI-ARREST"
      : derived.in_arrest
        ? "CARDIAC ARREST"
        : "TRAUMA ASSESSMENT"

  const causes = computeCauses(derived)
  const primaryCause = causes[0] ?? null
  const secondaryConcerns = causes
    .slice(1)
    .map((c) => `${c.name} (${c.confidencePct}%)`)

  const immediateActions = fired
    .filter((r) => EMT_ACTION_CATS.has(r.cat))
    .map((r) => toEmtAction(r.then))
    .filter((a) => a.length > 0 && !FORBIDDEN_EMT.test(a))
    .slice(0, 6)

  let disposition: string
  if (withheld) {
    disposition =
      "Withhold / terminate resuscitation per criteria. Confirm with medical direction."
  } else if (derived.rosc === true) {
    disposition =
      "ROSC achieved. Package and transport with continuous monitoring."
  } else {
    const disp = fired.filter((r) => r.cat === "DISPOSITION")
    disposition = disp.length
      ? sanitizeDisposition(disp.map((r) => r.then).join(" ")) ||
        "Continue resuscitation, treat reversible causes, transport rapidly to a trauma centre."
      : "Continue resuscitation, treat reversible causes, transport rapidly to a trauma centre."
  }

  let confidence: EmtSummary["confidence"] = "Low"
  if (primaryCause) {
    if (primaryCause.confidencePct >= 80) confidence = "High"
    else if (primaryCause.confidencePct >= 55) confidence = "Moderate"
  }

  return {
    headline,
    primaryCause,
    immediateActions,
    secondaryConcerns,
    disposition,
    confidence,
    withhold: withheld,
  }
}

export function buildReport(facts: Facts): StructuredReport {
  const { derived, fired, withheld } = infer(facts)

  const byCat = new Map<Category, Rule[]>()
  for (const r of fired) {
    if (!byCat.has(r.cat)) byCat.set(r.cat, [])
    byCat.get(r.cat)!.push(r)
  }

  const usedConflicts = new Set<string>()
  const groups: ReportGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const rules = byCat.get(cat)
    if (!rules) continue
    groups.push({
      cat,
      label: CATEGORY_LABEL[cat],
      rules: rules.map((r) => {
        if (r.divergence) usedConflicts.add(r.divergence)
        return {
          id: r.id,
          priority: r.priority,
          text: r.then,
          sources: r.sources,
          divergence: r.divergence ?? null,
        }
      }),
    })
  }

  const divergences: DivergenceEntry[] = [...usedConflicts]
    .sort()
    .map((cid) => {
      const c = CONFLICTS[cid]
      return {
        id: cid,
        topic: c.topic,
        positions: c.positions,
        defaultResolution: c.default_resolution,
      }
    })

  return {
    emt: buildEmtSummary(derived, fired, withheld),
    derivedState: {
      tca: Boolean(derived.tca),
      peri_arrest: Boolean(derived.peri_arrest),
      hemorrhagic_shock: Boolean(derived.hemorrhagic_shock),
      pseudo_pea: Boolean(derived.pseudo_pea),
      signs_of_life: Boolean(derived.signs_of_life),
      in_arrest: Boolean(derived.in_arrest),
    },
    withheld,
    groups,
    divergences,
    ruleCount: fired.length,
  }
}
