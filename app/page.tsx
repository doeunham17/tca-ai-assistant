"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Activity, HeartPulse, Loader2, ArrowUp } from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import { TcaReport } from "@/components/tca-report"
import type { StructuredReport } from "@/lib/tca/engine"

const SUGGESTIONS = [
  "Penetrating chest stab wound, unresponsive, no pulse. Physician HEMS team with thoracotomy capability, suspected tamponade.",
  "Blunt trauma, no signs of life for 20 minutes, injuries look unsurvivable. Asystole on the monitor.",
  "Hypovolaemic peri-arrest, weak pulse, suspected pelvic fracture, basic crew with blood but no surgical capability.",
  "32-week pregnant patient, blunt trauma, unresponsive and pulseless in the ED.",
]

export default function Page() {
  const [started, setStarted] = useState(false)
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const busy = status === "submitted" || status === "streaming"

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    sendMessage({ text: trimmed })
    setInput("")
  }

  // Landing / start screen
  if (!started) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <HeartPulse className="size-8" aria-hidden />
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Traumatic Cardiac Arrest AI
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Prehospital decision support · Five-guideline synthesis · FPHC 2024
            · ERC 2021 · TCCC 2026 · NAEMSP 2012 · Schober 2024
          </p>
        </div>
        <Button
          size="lg"
          className="min-w-40 text-base"
          onClick={() => setStarted(true)}
        >
          Start
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Decision support only. Not a substitute for clinical judgement or
          medical direction.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HeartPulse className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-pretty text-sm font-semibold leading-tight sm:text-base">
            Traumatic Cardiac Arrest AI &mdash; Prehospital Decision Support
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Five-guideline decision support · FPHC 2024 · ERC 2021 · TCCC 2026
            · NAEMSP 2012 · Schober 2024
          </p>
        </div>
      </header>

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Activity className="size-6 text-primary" />}
              title="Describe the case"
              description="Enter the mechanism, vital signs, findings, setting, and provider capability. The rule engine returns prioritised, guideline-cited recommendations."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={`${message.id}-${i}`}>
                          {part.text}
                        </MessageResponse>
                      )
                    }
                    if (part.type === "tool-runInference") {
                      if (
                        part.state === "input-available" ||
                        part.state === "input-streaming"
                      ) {
                        return (
                          <div
                            key={`${message.id}-${i}`}
                            className="my-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                          >
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden
                            />
                            Running rule engine…
                          </div>
                        )
                      }
                      if (part.state === "output-available") {
                        return (
                          <TcaReport
                            key={`${message.id}-${i}`}
                            report={part.output as StructuredReport}
                          />
                        )
                      }
                      if (part.state === "output-error") {
                        return (
                          <div
                            key={`${message.id}-${i}`}
                            className="my-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                          >
                            Engine error: {part.errorText}
                          </div>
                        )
                      }
                    }
                    return null
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {error && (
            <div className="mx-auto mt-3 w-full max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">Unable to complete the request.</p>
              <p className="mt-1 text-xs leading-relaxed text-destructive/90">
                {error.message ||
                  "The AI Gateway returned an error. If this mentions billing or a credit card, add one to your Vercel account to unlock free Gateway credits, then try again."}
              </p>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(input)
            }}
            className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 focus-within:border-primary/50"
          >
            <textarea
              suppressHydrationWarning
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit(input)
                }
              }}
              rows={1}
              placeholder="Describe the case: mechanism, responsiveness, pulse, findings, setting, capability…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || busy}
              aria-label="Send case description"
              className="shrink-0"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Decision support only. Not a substitute for clinical judgement or medical direction.
          </p>
        </div>
      </div>
    </div>
  )
}
