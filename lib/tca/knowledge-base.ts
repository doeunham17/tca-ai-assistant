// Unified Traumatic Cardiac Arrest (TCA) Expert System — KNOWLEDGE BASE (TS port)
// Merges the clinical logic of six source documents into one inferable ruleset.
// Decision support only. Expert-consensus / observational evidence (no TCA RCTs).

// --------------------------------------------------------------------------
// SOURCE REGISTRY
// --------------------------------------------------------------------------
export const SOURCES: Record<string, string> = {
  FPHC2024:
    "FPHC 2024 (Weegenaar/Perkins/Lockey) — Scand J Trauma Resusc Emerg Med 32:139",
  ERC2021: "ERC 2021 (Lott et al.) — Resuscitation 161:152-219 (incl. corrigenda)",
  TCCC2026: "TCCC Guidelines 2026 — CoTCCC / Joint Trauma System",
  NAEMSP2012: "NAEMSP & ACS-COT 2012 — Prehosp Emerg Care 16:571 (TOR position)",
  Schober2024: "Schober et al. 2024 — J Clin Med 13:302 (TCA narrative review)",
}

// --------------------------------------------------------------------------
// CONDITION DSL HELPERS — rules are plain data, evaluated by engine.ts
// --------------------------------------------------------------------------
type Cond = Record<string, unknown>
const EQ = (fact: string, val: unknown): Cond => ({ fact, op: "eq", val })
const NE = (fact: string, val: unknown): Cond => ({ fact, op: "ne", val })
const IN = (fact: string, ...vs: unknown[]): Cond => ({ fact, op: "in", val: vs })
const GTE = (fact: string, val: number): Cond => ({ fact, op: "gte", val })
const LTE = (fact: string, val: number): Cond => ({ fact, op: "lte", val })
const ALL = (...cs: Cond[]): Cond => ({ all: cs })
const ANY = (...cs: Cond[]): Cond => ({ any: cs })
const NOT = (c: Cond): Cond => ({ not: c })

// Shorthand for the most common guards
const TCA = EQ("tca", true)
const PERI = EQ("peri_arrest", true)
const SHOCK = EQ("hemorrhagic_shock", true)
const TCA_OR_PERI = ANY(TCA, PERI)
const NOT_MEDICAL = NOT(EQ("suspected_medical_cause", true))

// --------------------------------------------------------------------------
// CATEGORY ORDER — for report grouping; earlier printed first
// --------------------------------------------------------------------------
export type Category =
  | "GATE"
  | "CAUTION"
  | "IMMEDIATE"
  | "AIRWAY"
  | "BREATHING"
  | "CIRCULATION"
  | "PROCEDURE"
  | "DRUGS"
  | "NEURO"
  | "POPULATION"
  | "DIAGNOSTIC"
  | "DISPOSITION"

export const CATEGORY_ORDER: Category[] = [
  "GATE",
  "CAUTION",
  "IMMEDIATE",
  "AIRWAY",
  "BREATHING",
  "CIRCULATION",
  "PROCEDURE",
  "DRUGS",
  "NEURO",
  "POPULATION",
  "DIAGNOSTIC",
  "DISPOSITION",
]

export const CATEGORY_LABEL: Record<Category, string> = {
  GATE: "Triage / Safety Gate",
  CAUTION: "Cautions",
  IMMEDIATE: "Immediate — Reversible Causes (do simultaneously)",
  AIRWAY: "Airway (O of HOTT)",
  BREATHING: "Breathing / Tension Pneumothorax (T)",
  CIRCULATION: "Circulation / Haemorrhage (H)",
  PROCEDURE: "Procedures — Tamponade / Thoracotomy (T)",
  DRUGS: "Drugs",
  NEURO: "Disability / Neuro",
  POPULATION: "Special Populations",
  DIAGNOSTIC: "Diagnostics",
  DISPOSITION: "Disposition / Transport / Post-ROSC",
}

// --------------------------------------------------------------------------
// CONFLICT REGISTRY — where the six sources genuinely disagree
// --------------------------------------------------------------------------
export interface Conflict {
  topic: string
  positions: Record<string, string>
  default_resolution: string
}

export const CONFLICTS: Record<string, Conflict> = {
  "CON-THORACOSTOMY": {
    topic:
      "First-line chest decompression: finger/simple thoracostomy vs needle",
    positions: {
      FPHC2024:
        "Bilateral thoracostomy preferred; needle only if thoracostomy unavailable",
      ERC2021:
        "Open thoracostomy preferred under PPV; needle is a temporising alternative",
      Schober2024:
        "Thoracostomy 'disputably' more effective; needle appropriate to buy time",
      TCCC2026:
        "Needle decompression is FIRST-LINE prehospital (scope/skill); finger thoracostomy for refractory shock by authorised providers",
    },
    default_resolution:
      "Scope-dependent: if provider can perform thoracostomy -> bilateral finger thoracostomy; otherwise large-bore needle decompression (>=7 cm) and recheck for clotting.",
  },
  "CON-TOR-DURATION": {
    topic: "Required CPR duration before termination of resuscitation",
    positions: {
      NAEMSP2012:
        "Past guidance 'up to 15 min'; explicitly states science is unclear; mandates a specific protocol interval",
      ERC2021:
        "No fixed CPR time; withhold if >=15 min no signs of life; terminate after reversible causes addressed / no cardiac motion",
      Schober2024:
        "Optional additional ~10 min CPR (not evidence-backed) for team consensus / family presence",
    },
    default_resolution:
      "No single mandated number. Terminate once reversible causes are addressed with no ROSC and no cardiac motion; apply a locally-defined CPR interval under physician oversight.",
  },
  "CON-ADRENALINE": {
    topic: "Early adrenaline (epinephrine) in TCA",
    positions: {
      Schober2024:
        "De-prioritise/avoid; retrospective data favour less/no adrenaline; exception = SCI/neurogenic shock",
      ERC2021: "Reversible-cause treatment > early adrenaline",
      FPHC2024: "Focus on reversible causes; adrenaline not emphasised",
      "ATLS(noted)":
        "Still advocated early in some algorithms (e.g. ATLS 10th ed) — minority position cited by Schober",
    },
    default_resolution:
      "Do NOT prioritise early adrenaline in hypovolaemic/obstructive TCA. Reasonable in SCI/neurogenic (relative) hypovolaemia.",
  },
  "CON-CRYSTALLOID": {
    topic: "Crystalloid use in TCA",
    positions: {
      FPHC2024:
        "Crystalloid NOT recommended unless arrest imminent AND blood unavailable",
      ERC2021: "Blood products preferred; crystalloid is a fallback",
      TCCC2026:
        "Blood-product ladder for haemorrhage; crystalloid (LR/NS/Hextend) used for BURN resuscitation (different context)",
    },
    default_resolution:
      "Blood-first for haemorrhagic TCA; crystalloid only as fallback when blood is unavailable (or per burn-specific Rule-of-Ten).",
  },
  "CON-REBOA": {
    topic: "REBOA / aortic occlusion in TCA",
    positions: {
      FPHC2024:
        "Experimental; UK-REBOA harm signal; must not delay definitive control",
      ERC2021: "Role undetermined; last-resort under expertise/governance",
      Schober2024: "Debated; indications/benefits not universally accepted",
    },
    default_resolution:
      "Not routine. Only under specific protocols/research with governance, and never delaying definitive haemorrhage control.",
  },
}

// --------------------------------------------------------------------------
// DEEP-CONTENT MODULES
// --------------------------------------------------------------------------
export const MODULES: Record<string, string> = {
  tccc_march_phases:
    "Care Under Fire / TFC (MARCH) / TACEVAC full sequence, doses, ketamine/TXA/antibiotics, burns Rule of Ten",
  erc_special_causes:
    "hyperkalaemia ladder, hypothermia staging, PE/anaphylaxis/sepsis/toxins, special settings & patients",
  fphc_tca_detail:
    "FPHC HOTT detail, ultrasound, obstetric/paediatric, termination",
  naemsp_governance: "TOR governance requirements",
  schober_pathophysiology:
    "PEA/pseudo-PEA, resuscitation-before-intubation, adrenaline nuance, exceptions",
}

// --------------------------------------------------------------------------
// FACT SCHEMA — accepted input keys + value domains (for the model)
// --------------------------------------------------------------------------
export const FACT_SCHEMA: Record<string, string> = {
  setting: "prehospital | inhospital | tactical_cuf | tactical_tfc | tacevac | mci",
  trauma: "bool",
  mechanism: "blunt | penetrating | blast | mixed",
  responsive: "bool",
  pulse: "present | weak | absent",
  signs_of_life: "bool (derived if omitted)",
  minutes_no_signs_of_life: "number",
  minutes_since_arrest: "number",
  suspected_medical_cause: "bool",
  injuries_incompatible_with_life: "bool",
  rhythm: "shockable | pea | asystole | organized | unknown",
  cardiac_motion: "present | absent | not_assessed",
  reversible_causes_addressed: "bool",
  rosc: "bool",
  hypovolemia: "confirmed | suspected | absent | unknown",
  external_hemorrhage: "bool",
  tension_pneumothorax: "confirmed | suspected | absent | unknown",
  tamponade: "confirmed | suspected | absent | unknown",
  chest_injury: "penetrating | blunt | none",
  torso_trauma: "bool",
  pelvic_fracture_suspected: "bool",
  noncompressible_torso_hemorrhage: "bool",
  open_chest_wound: "bool",
  ppv: "planned | active | none",
  blood_available: "bool",
  blood_transfused: "bool",
  major_amputation: "bool",
  provider_can_thoracostomy: "bool",
  thoracotomy_capable: "bool",
  intubated: "bool",
  airway_obstruction_unmanageable: "bool",
  tbi_suspected: "bool",
  tbi_isolated: "bool",
  cardiac_contusion: "bool",
  asphyxia: "bool",
  spinal_cord_injury_suspected: "bool",
  herniation_signs: "bool",
  age_group: "adult | paediatric",
  pregnant: "bool",
  gestation_weeks: "number",
  uterus_above_umbilicus: "bool",
  pocus_available: "bool",
  on_scene_time_critical_capability: "bool",
}

// --------------------------------------------------------------------------
// RULE BASE — id, cat, priority(0=most urgent), when, then, sources[], divergence?
// --------------------------------------------------------------------------
export interface Rule {
  id: string
  cat: Category
  priority: number
  when: Cond
  then: string
  sources: string[]
  divergence?: string
}

export const RULES: Rule[] = [
  // ---------------- TRIAGE / SAFETY GATES ----------------
  {
    id: "G01-MEDICAL",
    cat: "GATE",
    priority: 0,
    when: ALL(EQ("trauma", true), EQ("suspected_medical_cause", true)),
    then: "Treat as a MEDICAL arrest — follow the standard ALS algorithm (chest compressions, adrenaline, 4H/4T). Do not misclassify a medical arrest (e.g. MI then crash) as traumatic; a traumatic arrest requires an ADEQUATE mechanism of injury.",
    sources: ["ERC2021", "Schober2024", "FPHC2024"],
  },
  {
    id: "G02-SHOCKABLE",
    cat: "GATE",
    priority: 0,
    when: ALL(EQ("trauma", true), EQ("rhythm", "shockable")),
    then: "DEFIBRILLATE immediately. A shockable rhythm in a trauma patient may indicate a MEDICAL aetiology — also treat per standard ALS.",
    sources: ["ERC2021", "Schober2024", "FPHC2024"],
  },
  {
    id: "G03-WITHHOLD",
    cat: "GATE",
    priority: 0,
    when: ALL(
      EQ("trauma", true),
      EQ("signs_of_life", false),
      ANY(
        EQ("injuries_incompatible_with_life", true),
        GTE("minutes_no_signs_of_life", 15),
      ),
    ),
    then: "WITHHOLD resuscitation: no signs of life for >=15 min and/or injuries incompatible with survival (e.g. decapitation, penetrating brain injury, loss of brain tissue).",
    sources: ["ERC2021", "Schober2024", "NAEMSP2012"],
  },
  {
    id: "G04-WITHHOLD-NAEMSP",
    cat: "GATE",
    priority: 0,
    when: ALL(
      EQ("trauma", true),
      EQ("responsive", false),
      EQ("pulse", "absent"),
      EQ("rhythm", "asystole"),
    ),
    then: "Consider WITHHOLDING (ACS/NAEMSP): apnoea + pulselessness + absence of organised ECG activity. Requires physician oversight & local protocol.",
    sources: ["NAEMSP2012", "Schober2024"],
  },
  {
    id: "G05-TERMINATE-NOROSC",
    cat: "GATE",
    priority: 1,
    when: ALL(TCA, EQ("reversible_causes_addressed", true), EQ("rosc", false)),
    then: "Consider TERMINATION of resuscitation: no ROSC after ALL potentially reversible causes (HOTT) have been addressed.",
    sources: ["ERC2021", "NAEMSP2012", "FPHC2024", "Schober2024"],
    divergence: "CON-TOR-DURATION",
  },
  {
    id: "G06-TERMINATE-NOMOTION",
    cat: "GATE",
    priority: 1,
    when: ALL(
      TCA,
      EQ("reversible_causes_addressed", true),
      EQ("cardiac_motion", "absent"),
    ),
    then: "Consider TERMINATION: no cardiac motion on POCUS (even with organised ECG) after reversible causes addressed — survival to discharge ~0% in this state.",
    sources: ["ERC2021", "Schober2024", "FPHC2024"],
  },
  {
    id: "G07-TOR-GOVERNANCE",
    cat: "GATE",
    priority: 2,
    when: ALL(
      TCA,
      EQ("reversible_causes_addressed", true),
      ANY(EQ("rosc", false), EQ("cardiac_motion", "absent")),
    ),
    then: "TOR requires active PHYSICIAN OVERSIGHT, standard deceased-management procedures, family support, and locally-defined exclusions. TOR may be impractical once transport has begun.",
    sources: ["NAEMSP2012"],
  },
  {
    id: "G08-MCI",
    cat: "GATE",
    priority: 1,
    when: EQ("setting", "mci"),
    then: "MASS-CASUALTY: it may be appropriate to WITHHOLD TCA resuscitation to preserve scarce skills/resources for salvageable casualties. Apply local triage tools; perform only quick life-saving interventions (airway, bleeding, chest decompression).",
    sources: ["ERC2021", "FPHC2024", "TCCC2026"],
  },

  // ---------------- CAUTIONS ----------------
  {
    id: "C09-PSEUDO-PEA",
    cat: "CAUTION",
    priority: 1,
    when: ALL(EQ("trauma", true), EQ("pseudo_pea", true)),
    then: "PSEUDO-PEA (organised rhythm + cardiac motion on POCUS, no palpable pulse): do NOT treat as true PEA. Avoid routine chest compressions and 1 mg adrenaline — rapidly treat the cause (esp. hypovolaemia). Manual pulse palpation is unreliable.",
    sources: ["Schober2024"],
  },
  {
    id: "C04-PPV",
    cat: "CAUTION",
    priority: 2,
    when: ANY(
      IN("tension_pneumothorax", "suspected", "confirmed"),
      IN("tamponade", "suspected", "confirmed"),
      IN("hypovolemia", "suspected", "confirmed"),
    ),
    then: "CAUTION: positive-pressure ventilation can precipitate or worsen arrest in hypovolaemia, tamponade or tension pneumothorax (impaired venous return). Decompress / treat first; use low tidal volumes, minimal PEEP, slow rate.",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
  },
  {
    id: "A03-RESUS-BEFORE-INTUB",
    cat: "CAUTION",
    priority: 3,
    when: PERI,
    then: "'Resuscitation before intubation': postpone drug-assisted intubation in under-resuscitated hypovolaemia — induction agents + PPV worsen haemodynamics and intubation attempts can themselves precipitate TCA. A patent (open) airway suffices initially.",
    sources: ["Schober2024", "FPHC2024"],
  },

  // ---------------- IMMEDIATE / CORE ----------------
  {
    id: "C01-SIMULTANEOUS",
    cat: "IMMEDIATE",
    priority: 1,
    when: TCA_OR_PERI,
    then: "Address the reversible causes (HOTT: Hypovolaemia, Oxygenation, Tension pneumothorax, Tamponade) SIMULTANEOUSLY — this takes priority over chest compressions and early adrenaline.",
    sources: ["FPHC2024", "ERC2021", "TCCC2026", "NAEMSP2012", "Schober2024"],
  },
  {
    id: "C02-DONT-PUMP",
    cat: "IMMEDIATE",
    priority: 2,
    when: ALL(
      TCA,
      NOT_MEDICAL,
      ANY(
        IN("hypovolemia", "suspected", "confirmed"),
        IN("tension_pneumothorax", "suspected", "confirmed"),
        IN("tamponade", "suspected", "confirmed"),
      ),
    ),
    then: "'Don't pump an empty heart' — chest compressions are LOWER priority than treating reversible causes in hypovolaemic / obstructive TCA (likely ineffective or harmful).",
    sources: ["ERC2021", "FPHC2024", "Schober2024"],
  },
  {
    id: "C03-DO-COMPRESS",
    cat: "IMMEDIATE",
    priority: 1,
    when: ALL(
      EQ("trauma", true),
      ANY(
        EQ("tbi_isolated", true),
        EQ("cardiac_contusion", true),
        EQ("asphyxia", true),
        EQ("suspected_medical_cause", true),
      ),
    ),
    then: "DO perform high-quality chest compressions (standard ALS): non-hypovolaemic / non-obstructive cause present (isolated TBI / impact brain apnoea, cardiac contusion, asphyxia, or medical aetiology).",
    sources: ["FPHC2024", "Schober2024"],
  },

  // ---------------- AIRWAY (O) ----------------
  {
    id: "A01-OXYGEN",
    cat: "AIRWAY",
    priority: 2,
    when: TCA_OR_PERI,
    then: "Give 100% high-flow OXYGEN to all TCA / peri-arrest patients (oxygen cascade impaired at multiple levels; SpO2/ABG unavailable early).",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
  },
  {
    id: "A02-PATENT-AIRWAY",
    cat: "AIRWAY",
    priority: 2,
    when: TCA_OR_PERI,
    then: "Establish an OPEN/patent airway (jaw thrust, OPA, suction, SGA per skill). A secured cuffed-ETT airway is NOT immediately required.",
    sources: ["Schober2024", "FPHC2024", "TCCC2026"],
  },
  {
    id: "A04-CRIC",
    cat: "AIRWAY",
    priority: 1,
    when: EQ("airway_obstruction_unmanageable", true),
    then: "Unmanageable airway obstruction (facial fractures, direct airway injury, blood, deformation, burns) -> surgical cricothyroidotomy (cannula OD <10 mm, ID 6-7 mm, 5-8 cm); verify with continuous EtCO2; lidocaine if conscious.",
    sources: ["FPHC2024", "TCCC2026"],
  },
  {
    id: "A05-POSTINTUB",
    cat: "AIRWAY",
    priority: 3,
    when: EQ("intubated", true),
    then: "Post-intubation: 100% O2 and MANDATORY continuous EtCO2 (waveform capnography). After ROSC ventilate lung-protective 4-6 ml/kg targeting normocapnia & normoxia.",
    sources: ["FPHC2024", "ERC2021"],
  },

  // ---------------- BREATHING / TENSION PNEUMOTHORAX (T) ----------------
  {
    id: "B01-DECOMPRESS",
    cat: "BREATHING",
    priority: 1,
    when: ALL(TCA_OR_PERI, IN("tension_pneumothorax", "suspected", "confirmed")),
    then: "IMMEDIATE chest decompression for suspected/confirmed tension pneumothorax — perform without pausing for examination or imaging.",
    sources: ["FPHC2024", "ERC2021", "TCCC2026", "Schober2024", "NAEMSP2012"],
  },
  {
    id: "B02-THORACOSTOMY",
    cat: "BREATHING",
    priority: 1,
    when: ALL(
      IN("tension_pneumothorax", "suspected", "confirmed"),
      EQ("provider_can_thoracostomy", true),
    ),
    then: "Preferred: rapid BILATERAL finger/simple thoracostomy in the 4th-5th ICS just anterior to the mid-axillary line. Faster than a chest tube; extendable to clamshell.",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
    divergence: "CON-THORACOSTOMY",
  },
  {
    id: "B03-NEEDLE",
    cat: "BREATHING",
    priority: 1,
    when: ALL(
      IN("tension_pneumothorax", "suspected", "confirmed"),
      EQ("provider_can_thoracostomy", false),
    ),
    then: "Needle decompression when thoracostomy is unavailable / out-of-scope: large-bore >=7 cm (e.g. 14G or 10G, 3.25 in) at 5th ICS anterior axillary line OR 2nd ICS mid-clavicular line; remove needle, leave catheter; recheck for clotting/kinking.",
    sources: ["TCCC2026", "FPHC2024", "ERC2021", "Schober2024"],
    divergence: "CON-THORACOSTOMY",
  },
  {
    id: "B04-BILATERAL-ARREST",
    cat: "BREATHING",
    priority: 1,
    when: ALL(
      TCA,
      ANY(
        EQ("torso_trauma", true),
        IN("chest_injury", "penetrating", "blunt"),
        EQ("mechanism", "blast"),
      ),
    ),
    then: "Torso trauma / blast in traumatic arrest -> decompress BOTH sides of the chest before discontinuing care (exclude bilateral tension pneumothorax).",
    sources: ["TCCC2026", "FPHC2024"],
  },
  {
    id: "B05-CHEST-SEAL",
    cat: "BREATHING",
    priority: 2,
    when: EQ("open_chest_wound", true),
    then: "Open / sucking chest wound -> apply a VENTED chest seal (non-vented if unavailable). Monitor for subsequent tension pneumothorax; burp/remove or decompress if hypoxia, distress or hypotension develop.",
    sources: ["TCCC2026"],
  },

  // ---------------- CIRCULATION / HAEMORRHAGE (H) ----------------
  {
    id: "D02-CUF-TQ",
    cat: "CIRCULATION",
    priority: 0,
    when: EQ("setting", "tactical_cuf"),
    then: "CARE UNDER FIRE: if tactically feasible, apply a CoTCCC limb tourniquet 'high and tight' over the uniform, proximal to bleeding; defer airway and other care to Tactical Field Care.",
    sources: ["TCCC2026"],
  },
  {
    id: "D01-EXT-HEM",
    cat: "CIRCULATION",
    priority: 1,
    when: EQ("external_hemorrhage", true),
    then: "Rapidly control external haemorrhage via the haemostatic ladder: direct pressure -> haemostatic dressing (Combat Gauze) -> tourniquet (2-3 in above site; side-by-side 2nd if needed). Pelvic binder / extremity tourniquet prevents further loss if ROSC achieved.",
    sources: ["FPHC2024", "ERC2021", "TCCC2026", "Schober2024", "NAEMSP2012"],
  },
  {
    id: "D08-PELVIC",
    cat: "CIRCULATION",
    priority: 2,
    when: EQ("pelvic_fracture_suspected", true),
    then: "Apply a PELVIC BINDER for suspected pelvic fracture (severe blunt/blast + pelvic pain, major lower-limb amputation, exam findings, unconsciousness, or shock).",
    sources: ["FPHC2024", "TCCC2026"],
  },
  {
    id: "D03-BLOOD",
    cat: "CIRCULATION",
    priority: 1,
    when: SHOCK,
    then: "Use BLOOD / blood products EARLY for hypovolaemic TCA / peri-arrest (preferred over other fluids). Use when rapid assessment suggests resuscitation is possible — not in all TCA.",
    sources: ["FPHC2024", "ERC2021", "TCCC2026", "Schober2024"],
  },
  {
    id: "D04-BLOOD-ORDER",
    cat: "CIRCULATION",
    priority: 2,
    when: ALL(SHOCK, EQ("blood_available", true)),
    then: "Transfuse in order of preference: cold-stored low-titre O whole blood -> low-titre O fresh whole blood -> plasma:RBC:platelets 1:1:1 -> plasma:RBC 1:1 -> plasma or RBCs alone. Reassess after each unit; endpoints = palpable radial pulse / improved mentation / SBP ~100 mmHg.",
    sources: ["TCCC2026"],
  },
  {
    id: "D05-CALCIUM",
    cat: "CIRCULATION",
    priority: 2,
    when: EQ("blood_transfused", true),
    then: "Give 1 g CALCIUM (30 ml 10% calcium gluconate OR 10 ml 10% calcium chloride) IV/IO after the FIRST transfused product.",
    sources: ["TCCC2026"],
  },
  {
    id: "D06-TXA",
    cat: "CIRCULATION",
    priority: 2,
    when: ALL(
      EQ("trauma", true),
      ANY(
        SHOCK,
        EQ("major_amputation", true),
        EQ("chest_injury", "penetrating"),
        EQ("tbi_suspected", true),
      ),
    ),
    then: "Give TRANEXAMIC ACID as soon as possible and NOT later than 3 h after injury (TCCC: 2 g IV/IO; ERC trauma: 1 g over 10 min then 1 g over 8 h). Do not start after the 3 h window.",
    sources: ["TCCC2026", "FPHC2024", "ERC2021"],
  },
  {
    id: "D07-CRYSTALLOID",
    cat: "CIRCULATION",
    priority: 3,
    when: ALL(SHOCK, EQ("blood_available", false)),
    then: "Crystalloid ONLY if blood products are unavailable AND cardiac arrest is imminent — blood-first is strongly preferred.",
    sources: ["FPHC2024", "ERC2021"],
    divergence: "CON-CRYSTALLOID",
  },
  {
    id: "D09-PERMISSIVE",
    cat: "CIRCULATION",
    priority: 2,
    when: PERI,
    then: "Damage-control resuscitation: permissive hypotension (titrate to a radial pulse) until surgical haemorrhage control, for <=60 min. EXCEPTION: target a higher blood pressure if traumatic brain injury is present.",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
  },
  {
    id: "D10-REBOA",
    cat: "CIRCULATION",
    priority: 3,
    when: ALL(SHOCK, EQ("noncompressible_torso_hemorrhage", true)),
    then: "Aortic occlusion / REBOA is experimental / undetermined — NOT routine. Only under specific protocols/research with comprehensive governance, and it must NOT delay definitive haemorrhage control.",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
    divergence: "CON-REBOA",
  },
  {
    id: "D11-SOURCE-CONTROL",
    cat: "CIRCULATION",
    priority: 2,
    when: SHOCK,
    then: "Temporary measures buy time only — definitive HAEMORRHAGE SOURCE CONTROL (surgery) is essential ('fix the leaking tank AND refill it'). Internal sources: chest, abdomen, pelvis, long bones.",
    sources: ["Schober2024", "FPHC2024"],
  },

  // ---------------- PROCEDURES — TAMPONADE / THORACOTOMY (T) ----------------
  {
    id: "E01-RT-INDICATED",
    cat: "PROCEDURE",
    priority: 1,
    when: ALL(
      TCA,
      EQ("chest_injury", "penetrating"),
      IN("tamponade", "suspected", "confirmed"),
    ),
    then: "Penetrating chest/epigastric TCA with tamponade -> IMMEDIATE resuscitative (clamshell) thoracotomy as soon as possible after arrest. Best outcomes for penetrating injury (stab >> gunshot). Abandon the 'futility of thoracotomy' dogma.",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
  },
  {
    id: "E02-RT-4E",
    cat: "PROCEDURE",
    priority: 1,
    when: ALL(
      IN("tamponade", "suspected", "confirmed"),
      EQ("thoracotomy_capable", true),
    ),
    then: "Resuscitative thoracotomy 4E GATE — proceed only if ALL met: Expertise (trained provider, governance) + Equipment + Environment + Elapsed time since loss of vital signs <15 min. If any criterion fails, RT is futile.",
    sources: ["ERC2021", "Schober2024"],
  },
  {
    id: "E03-RT-TRANSFER",
    cat: "PROCEDURE",
    priority: 1,
    when: ALL(
      IN("tamponade", "suspected", "confirmed"),
      EQ("thoracotomy_capable", false),
    ),
    then: "Tamponade but no thoracotomy capability on scene -> RAPID transfer to surgical/ED capability; cardiac tamponade causing TCA is rapidly fatal and must be evacuated by thoracotomy.",
    sources: ["FPHC2024"],
  },
  {
    id: "E04-PERICARDIO",
    cat: "PROCEDURE",
    priority: 2,
    when: ALL(
      IN("tamponade", "suspected", "confirmed"),
      EQ("thoracotomy_capable", false),
      EQ("setting", "inhospital"),
    ),
    then: "If thoracotomy is not possible: ultrasound-guided pericardiocentesis (non-image-guided only if US unavailable). NOTE: no role for blind needle pericardiocentesis in penetrating cardiac TCA prehospital — clotted blood is usually present.",
    sources: ["ERC2021", "FPHC2024"],
  },
  {
    id: "E05-TAMPONADE-PULSE",
    cat: "PROCEDURE",
    priority: 2,
    when: ALL(IN("tamponade", "suspected", "confirmed"), EQ("pulse", "weak")),
    then: "Tamponade with a pulse still present -> rapid transfer to the OR for surgery may be preferable to on-scene thoracotomy.",
    sources: ["Schober2024"],
  },

  // ---------------- DRUGS ----------------
  {
    id: "H01-ADRENALINE-DEFAULT",
    cat: "DRUGS",
    priority: 3,
    when: ALL(TCA, NOT(EQ("spinal_cord_injury_suspected", true)), NOT_MEDICAL),
    then: "De-prioritise / avoid early ADRENALINE in hypovolaemic TCA — favour higher-yield reversible-cause interventions. Evidence is questionable; retrospective data suggest less/no adrenaline may improve survival.",
    sources: ["Schober2024", "ERC2021", "FPHC2024"],
    divergence: "CON-ADRENALINE",
  },
  {
    id: "H02-ADRENALINE-SCI",
    cat: "DRUGS",
    priority: 2,
    when: ALL(TCA, EQ("spinal_cord_injury_suspected", true)),
    then: "EXCEPTION: spinal-cord-injury / neurogenic (relative) hypovolaemia with vasoplegia (+/- denervation bradycardia) -> a catecholamine (adrenaline) IS an appropriate indication, alongside fluids.",
    sources: ["Schober2024"],
  },

  // ---------------- DISABILITY / NEURO ----------------
  {
    id: "I01-TBI-NOT-FUTILE",
    cat: "NEURO",
    priority: 2,
    when: ALL(EQ("trauma", true), EQ("tbi_suspected", true)),
    then: "TCA complicated by TBI is NOT automatically futile — resuscitate and evacuate to neurosurgical capability (outcomes improved with surgery <5 h of injury).",
    sources: ["Schober2024", "TCCC2026"],
  },
  {
    id: "I02-TBI-TARGETS",
    cat: "NEURO",
    priority: 2,
    when: EQ("tbi_suspected", true),
    then: "TBI physiology: prevent hypoxaemia (SpO2 >=92%) and hypotension (SBP >100 mmHg, or a normal radial pulse if no BP). If ventilated, target EtCO2 35-45 mmHg (else 10 breaths/min).",
    sources: ["TCCC2026", "FPHC2024"],
  },
  {
    id: "I03-TBI-SHOCK-PRECEDENCE",
    cat: "NEURO",
    priority: 1,
    when: ALL(EQ("tbi_suspected", true), SHOCK),
    then: "If haemorrhagic shock co-exists with TBI, haemorrhagic-shock resuscitation TAKES PRECEDENCE over TBI-specific management. (If no haemorrhage: consider 1-2 units plasma; plasma not for mild TBI.)",
    sources: ["TCCC2026"],
  },
  {
    id: "I04-HERNIATION",
    cat: "NEURO",
    priority: 1,
    when: EQ("herniation_signs", true),
    then: "Herniation (asymmetric or fixed/dilated pupil, posturing) -> hypertonic saline: 250 ml 3%/5% OR 30 ml 23.4% IV/IO over >=10 min, then flush; repeat x1 at 20 min (max 2). NOT prophylactic; NOT a resuscitative fluid.",
    sources: ["TCCC2026"],
  },
  {
    id: "I05-SPINE",
    cat: "NEURO",
    priority: 3,
    when: ALL(EQ("trauma", true), EQ("spinal_cord_injury_suspected", true)),
    then: "'Life before limb': reversible-cause treatment and ROSC take priority over resource-intensive c-spine protection. C-spine stabilisation is not required for penetrating-only trauma.",
    sources: ["Schober2024", "TCCC2026"],
  },

  // ---------------- SPECIAL POPULATIONS ----------------
  {
    id: "J01-PAEDS",
    cat: "POPULATION",
    priority: 1,
    when: ALL(EQ("age_group", "paediatric"), TCA_OR_PERI),
    then: "PAEDIATRIC TCA: same priorities as adults with EMPHASIS on early hypoxaemia management; resuscitation is not inherently futile. Best outcomes for short hypoxic/asphyxial arrest.",
    sources: ["FPHC2024", "Schober2024", "ERC2021"],
  },
  {
    id: "J02-PREG-DISPLACE",
    cat: "POPULATION",
    priority: 1,
    when: ALL(
      EQ("pregnant", true),
      ANY(GTE("gestation_weeks", 20), EQ("uterus_above_umbilicus", true)),
    ),
    then: "Pregnancy >=20 wk / uterus above umbilicus: MANUAL LEFT UTERINE DISPLACEMENT to relieve aortocaval compression; keep supine for high-quality compressions (mechanical compression devices not recommended in pregnancy).",
    sources: ["FPHC2024", "ERC2021"],
  },
  {
    id: "J03-PREG-HYSTEROTOMY",
    cat: "POPULATION",
    priority: 1,
    when: ALL(
      EQ("pregnant", true),
      TCA,
      ANY(GTE("gestation_weeks", 20), EQ("uterus_above_umbilicus", true)),
    ),
    then: "Perform RESUSCITATIVE HYSTEROTOMY as soon as possible after arrest — aim to deliver within ~5 min of collapse; focus on MATERNAL survival. Decision-making must occur early, ideally at the arrest location.",
    sources: ["FPHC2024", "ERC2021"],
  },

  // ---------------- DIAGNOSTICS ----------------
  {
    id: "K01-POCUS-GATE",
    cat: "DIAGNOSTIC",
    priority: 3,
    when: EQ("pocus_available", true),
    then: "Use POCUS only if it will CHANGE management ('need to know': tamponade / pneumothorax / hypovolaemia, and cardiac motion). Trained users only; it must NOT delay treatment of reversible causes. (Protocols: eFAST / FATE / RUSH.)",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
  },
  {
    id: "K02-POCUS-PROG",
    cat: "DIAGNOSTIC",
    priority: 3,
    when: ALL(
      EQ("cardiac_motion", "absent"),
      EQ("reversible_causes_addressed", true),
    ),
    then: "Absent cardiac motion on POCUS after reversible causes addressed -> extremely poor prognosis; supports considering termination of resuscitation.",
    sources: ["FPHC2024", "ERC2021", "Schober2024"],
  },

  // ---------------- DISPOSITION ----------------
  {
    id: "L01-ROSC",
    cat: "DISPOSITION",
    priority: 1,
    when: EQ("rosc", true),
    then: "ROSC achieved -> IMMEDIATE transport to an appropriate hospital; in-hospital damage-control surgery / resuscitation. Post-ROSC: confirm perfusion/oxygenation (SpO2), normocapnia/normoxia, lung-protective ventilation.",
    sources: ["FPHC2024", "ERC2021"],
  },
  {
    id: "L02-NO-CAPABILITY",
    cat: "DISPOSITION",
    priority: 1,
    when: ALL(TCA_OR_PERI, EQ("on_scene_time_critical_capability", false)),
    then: "Time-critical interventions cannot be delivered on scene -> RAPID transfer to definitive care is the only management option (short prehospital times are associated with improved survival).",
    sources: ["FPHC2024"],
  },
  {
    id: "L03-HANDOVER",
    cat: "DISPOSITION",
    priority: 4,
    when: TCA_OR_PERI,
    then: "Document and hand over (MIST / TCCC DD-1380): mechanism of injury, injuries, signs/symptoms, treatments rendered; forward with the casualty to the next level of care.",
    sources: ["TCCC2026", "ERC2021"],
  },
  {
    id: "M01-HYPOTHERMIA",
    cat: "DISPOSITION",
    priority: 3,
    when: TCA_OR_PERI,
    then: "Initiate HYPOTHERMIA-PREVENTION during resuscitation: insulate from ground/wind, remove wet clothing, active warming to torso/axillae (not on bare skin), warm IV/IO fluids (up to 150 ml/min, 38 C).",
    sources: ["TCCC2026", "FPHC2024"],
  },
]

// Silence unused-helper lint without changing behaviour
void NE
void LTE
