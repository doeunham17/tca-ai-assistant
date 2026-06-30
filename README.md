# Traumatic Cardiac Arrest (TCA) Expert System Chatbot

A clinical decision-support chatbot for the prehospital and early in-hospital management of traumatic cardiac arrest (TCA). A forward-chaining rule engine evaluates a knowledge base synthesized from five published guideline sources and returns a structured, categorized report (gates, immediate actions, airway/breathing/circulation, procedures, drugs, disposition, etc.) in response to a free-text case description.

> **Decision support only.** This tool reflects expert-consensus and observational guidance — there are no randomized controlled trials for TCA. It is not a substitute for clinical judgment, local protocols, or medical training, and must not be used to guide real patient care.

## How it works

- **Knowledge base** (`lib/tca/knowledge-base.ts`) — rules expressed as plain data (conditions + actions), tagged by source and category.
- **Inference engine** (`lib/tca/engine.ts`) — derives secondary facts from the input case, forward-chains through the rules, and resolves conflicts/gates to produce a structured report.
- **Chat interface** (`app/page.tsx`, `app/api/chat/route.ts`) — a conversational front end (Google Gemini via the Vercel AI SDK) that extracts structured facts from natural-language case descriptions and renders the engine's output as a report (`components/tca-report.tsx`).

### Source guidelines synthesized
| Code | Source |
|---|---|
| FPHC2024 | Weegenaar/Perkins/Lockey, *Scand J Trauma Resusc Emerg Med* 32:139 (2024) |
| ERC2021 | Lott et al., *Resuscitation* 161:152–219 (2021, incl. corrigenda) |
| TCCC2026 | TCCC Guidelines 2026 — CoTCCC / Joint Trauma System |
| NAEMSP2012 | NAEMSP & ACS-COT, *Prehosp Emerg Care* 16:571 (2012) |
| Schober2024 | Schober et al., *J Clin Med* 13:302 (2024) |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Vercel AI SDK + Google Gemini · shadcn/ui

## Getting started

### Prerequisites
- Node.js 18+
- A package manager — this project ships a `pnpm-lock.yaml`, so [pnpm](https://pnpm.io) is recommended (`npm install -g pnpm`), though `npm install` will also work.
- A Google AI Studio API key with the Generative Language API enabled ([aistudio.google.com](https://aistudio.google.com/apikey))

### Setup
```bash
git clone https://github.com/doeunham17/tca-ai-assistant.git
cd tca-ai-assistant
pnpm install        # or: npm install

cp .env.example .env.local
# then edit .env.local and paste in your key
```

## Environment variables
| Variable | Description |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Google Gemini API key. Required for the chat endpoint to function. Never commit this — keep it only in `.env.local`, which is git-ignored. |

## Project structure
```
app/api/chat/route.ts     # Chat API route — calls Gemini, invokes the engine
app/page.tsx              # Chat UI
lib/tca/knowledge-base.ts # Rules + sources (the "expert" knowledge)
lib/tca/engine.ts         # Forward-chaining inference engine
components/tca-report.tsx # Renders the structured report
```

## License
Licensed under the MIT License. See [LICENSE](LICENSE) for the full text.
