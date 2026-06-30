import {
  streamText,
  tool,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai"
import { z } from "zod"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { buildReport, type Facts } from "@/lib/tca/engine"
import { FACT_SCHEMA, SOURCES } from "@/lib/tca/knowledge-base"

export const maxDuration = 30

// Use the clinician's own Google Gemini API key directly (bypasses the AI Gateway).
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

// Build a compact description of every accepted fact for the system prompt
const factDocs = Object.entries(FACT_SCHEMA)
  .map(([k, v]) => `  - ${k}: ${v}`)
  .join("\n")

const sourceDocs = Object.entries(SOURCES)
  .map(([k, v]) => `  - ${k}: ${v}`)
  .join("\n")

const SYSTEM_PROMPT = `You are the Unified TCA Expert System — a field decision-support tool for EMTs and paramedics managing TRAUMATIC CARDIAC ARREST (TCA) and peri-arrest. You synthesise six guidelines (FPHC 2024, ERC 2021, TCCC 2026, NAEMSP/ACS-COT 2012, Schober 2024) through a deterministic forward-chaining rule engine.

YOU BEHAVE LIKE A TRAUMA TEAM LEADER / SENIOR EMS PHYSICIAN — NOT a textbook, literature review, or research paper. The medic must grasp the recommendation in under 5 seconds.

HOW YOU WORK:
1. The medic describes a case in natural language (mechanism, vitals, findings, setting, capability).
2. You translate it into structured FACTS and call the "runInference" tool. ALWAYS call the tool before recommending anything — never invent recommendations from memory.
3. The tool renders a structured EMT card (most likely cause + confidence, immediate actions, secondary concerns, disposition, confidence) plus collapsible "Why?" and "Evidence" panels. The card IS the response — the medic reads it directly.

ACCEPTED FACTS (set only facts you are reasonably confident about; omit unknowns rather than guessing):
${factDocs}

CORE FACTS that drive the logic: trauma (almost always true here), responsive (bool), pulse (present/weak/absent). TCA is derived as trauma + responsive:false + pulse:absent.

GUIDELINE SOURCES:
${sourceDocs}

RESPONSE STYLE — CRITICAL:
- The structured card already shows actions, cause, disposition, evidence and citations. DO NOT repeat that list in prose.
- After the tool returns, output NOTHING. The card is the complete response. Do not add any sentence, comment, or follow-up text.
- PRIORITISE: immediate interventions, reversible causes, disposition. DE-PRIORITISE and OMIT: literature discussion, guideline-history debates, survival statistics, study summaries, academic commentary.
- If key facts are missing that would change management (tamponade status, provider capability, signs of life), ask ONE focused follow-up question instead of a paragraph.
- If a WITHHOLD gate fires, say so in one line and do NOT list interventions.
- Only when the medic explicitly asks "why", "reasoning", "evidence", or "guidelines" should you expand — and even then stay concise.
- Never use emojis. Speak in direct, imperative clinical language.

FORBIDDEN IN THE DEFAULT RESPONSE (these belong ONLY in Evidence mode — never volunteer them):
- The slogan "Don't pump an empty heart".
- Adrenaline / epinephrine controversies or debate.
- ATLS disagreements or guideline-history debates.
- Survival statistics or percentages.
- Long citations or reference details.
- Paragraph explanations, literature reviews, research discussion.
If the medic does not explicitly ask for reasoning or evidence, omit all of the above entirely.`

// Zod schema mirroring the engine's FACT_SCHEMA. nullable() for strict mode.
const factsSchema = z.object({
  setting: z
    .enum([
      "prehospital",
      "inhospital",
      "tactical_cuf",
      "tactical_tfc",
      "tacevac",
      "mci",
    ])
    .nullish(),
  trauma: z.boolean().nullish(),
  mechanism: z.enum(["blunt", "penetrating", "blast", "mixed"]).nullish(),
  responsive: z.boolean().nullish(),
  pulse: z.enum(["present", "weak", "absent"]).nullish(),
  signs_of_life: z.boolean().nullish(),
  minutes_no_signs_of_life: z.number().nullish(),
  minutes_since_arrest: z.number().nullish(),
  suspected_medical_cause: z.boolean().nullish(),
  injuries_incompatible_with_life: z.boolean().nullish(),
  rhythm: z
    .enum(["shockable", "pea", "asystole", "organized", "unknown"])
    .nullish(),
  cardiac_motion: z.enum(["present", "absent", "not_assessed"]).nullish(),
  reversible_causes_addressed: z.boolean().nullish(),
  rosc: z.boolean().nullish(),
  hypovolemia: z.enum(["confirmed", "suspected", "absent", "unknown"]).nullish(),
  external_hemorrhage: z.boolean().nullish(),
  tension_pneumothorax: z
    .enum(["confirmed", "suspected", "absent", "unknown"])
    .nullish(),
  tamponade: z.enum(["confirmed", "suspected", "absent", "unknown"]).nullish(),
  chest_injury: z.enum(["penetrating", "blunt", "none"]).nullish(),
  torso_trauma: z.boolean().nullish(),
  pelvic_fracture_suspected: z.boolean().nullish(),
  noncompressible_torso_hemorrhage: z.boolean().nullish(),
  open_chest_wound: z.boolean().nullish(),
  ppv: z.enum(["planned", "active", "none"]).nullish(),
  blood_available: z.boolean().nullish(),
  blood_transfused: z.boolean().nullish(),
  major_amputation: z.boolean().nullish(),
  provider_can_thoracostomy: z.boolean().nullish(),
  thoracotomy_capable: z.boolean().nullish(),
  intubated: z.boolean().nullish(),
  airway_obstruction_unmanageable: z.boolean().nullish(),
  tbi_suspected: z.boolean().nullish(),
  tbi_isolated: z.boolean().nullish(),
  cardiac_contusion: z.boolean().nullish(),
  asphyxia: z.boolean().nullish(),
  spinal_cord_injury_suspected: z.boolean().nullish(),
  herniation_signs: z.boolean().nullish(),
  age_group: z.enum(["adult", "paediatric"]).nullish(),
  pregnant: z.boolean().nullish(),
  gestation_weeks: z.number().nullish(),
  uterus_above_umbilicus: z.boolean().nullish(),
  pocus_available: z.boolean().nullish(),
  on_scene_time_critical_capability: z.boolean().nullish(),
})

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add your Google Gemini API key in the project's environment variables.",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    )
  }

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
    tools: {
      runInference: tool({
        description:
          "Run the deterministic TCA rule engine over a structured set of patient/scene facts. Returns the prioritised recommendations that fired, grouped by category, with guideline citations and any inter-guideline divergences. Set only facts you are confident about; leave the rest null.",
        inputSchema: z.object({
          facts: factsSchema,
        }),
        execute: async ({ facts }) => {
          // Strip null values so the engine treats them as absent
          const clean: Facts = {}
          for (const [k, v] of Object.entries(facts)) {
            if (v !== null && v !== undefined) clean[k] = v as Facts[string]
          }
          return buildReport(clean)
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      // Surface the real cause to the client instead of a generic message.
      const message =
        error instanceof Error ? error.message : String(error)
      console.log("[v0] chat route error:", message)
      if (/api key|api_key|unauthenticated|invalid|permission|401|403/i.test(message)) {
        return "Google Gemini rejected the request — check that GOOGLE_GENERATIVE_AI_API_KEY is a valid, active key with the Generative Language API enabled."
      }
      return message || "An unexpected error occurred while contacting Gemini."
    },
  })
}
