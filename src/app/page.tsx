"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ClipboardList,
  Headphones,
  Mic,
  Phone,
  ShieldAlert,
  Sparkles,
  TimerReset,
  UserRound,
} from "lucide-react";

type MessageSender = "assistant" | "caller" | "note";

interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: string;
}

interface CallContext {
  phoneNumber: string;
  purpose: string;
  talkingPoints: string[];
  handoffConditions: string[];
  consentToSummary: boolean;
}

const defaultContext: CallContext = {
  phoneNumber: "+1 (555) 013-4455",
  purpose: "Follow up on AI/ML job application",
  talkingPoints: [
    "Thank them for taking time to speak about the application submitted last week",
    "Confirm they received Manohar's portfolio link and technical writing sample",
    "Offer to schedule a 30-minute conversation with Manohar next week",
    "Highlight Manohar's availability on Tuesday through Thursday between 10 AM and 2 PM ET",
    "Reassure that Manohar will personally follow up after the conversation",
  ],
  handoffConditions: [
    "Caller requests to speak with Manohar directly",
    "Caller asks something outside the role or hiring process",
    "Caller remains silent for more than 5 seconds",
  ],
  consentToSummary: true,
};

const clarificationResponses = [
  "I'm supporting Manohar with scheduling and updates today. Could you clarify your question so I can make sure we stay on track?",
  "I'm here to keep things efficient for Manohar. Would you mind rephrasing that so I can assist accurately?",
];

const connectors = [
  "Just to make sure we're aligned,",
  "Additionally,",
  "On that note,",
  "As a next step,",
  "Before we wrap up,",
];

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseList = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const formatSeconds = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const humanizeTalkingPoint = (point: string, index: number) => {
  const trimmed = point.trim();
  if (!trimmed) return "";
  const sentence = trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  const prefix = connectors[index % connectors.length];
  return `${prefix} ${sentence}`;
};

const displayTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const buildKeywords = (context: CallContext) => {
  const text = [context.purpose, ...context.talkingPoints].join(" ").toLowerCase();
  const matches = text.match(/\b[a-z]{4,}\b/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
};

const buildSummary = (
  context: CallContext,
  conversation: Message[],
  coveredPoints: boolean[],
) => {
  const callerHighlights = conversation
    .filter((message) => message.sender === "caller")
    .slice(-3)
    .map((message) => `• ${message.content}`);

  const completedPoints = context.talkingPoints
    .map((point, index) =>
      coveredPoints[index] ? `• ${point}` : undefined,
    )
    .filter(Boolean);

  const nextStep =
    conversation.find(
      (message) =>
        message.sender === "assistant" &&
        /schedule|coordinate|follow up|send/i.test(message.content),
    )?.content ?? "Follow up with the caller to confirm next steps.";

  const summarySections = [
    `Purpose: ${context.purpose}.`,
    completedPoints.length
      ? `Covered talking points:\n${completedPoints.join("\n")}`
      : "Covered talking points: None were marked as complete.",
    callerHighlights.length
      ? `Caller responses worth noting:\n${callerHighlights.join("\n")}`
      : "Caller responses worth noting: Nothing specific captured.",
    `Recommended next step: ${nextStep}`,
  ];

  return summarySections.join("\n\n");
};

export default function Home() {
  const [callContext, setCallContext] = useState<CallContext>(defaultContext);
  const [talkingPointsInput, setTalkingPointsInput] = useState<string>(
    defaultContext.talkingPoints.join("\n"),
  );
  const [handoffInput, setHandoffInput] = useState<string>(
    defaultContext.handoffConditions.join("\n"),
  );
  const [conversation, setConversation] = useState<Message[]>([]);
  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [callerUtterance, setCallerUtterance] = useState("");
  const [clarificationsUsed, setClarificationsUsed] = useState(0);
  const [nextPointIndex, setNextPointIndex] = useState(0);
  const [coveredPoints, setCoveredPoints] = useState<boolean[]>(
    defaultContext.talkingPoints.map(() => false),
  );
  const [callSummary, setCallSummary] = useState<string | null>(null);
  const [callLaunchedAt, setCallLaunchedAt] = useState<Date | null>(null);

  const topicKeywords = useMemo(
    () => buildKeywords(callContext),
    [callContext],
  );

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(
      () => setElapsedSeconds((previous) => previous + 1),
      1000,
    );
    return () => clearInterval(interval);
  }, [callActive]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation]);

  const addMessage = (sender: MessageSender, content: string) => {
    setConversation((previous) => [
      ...previous,
      {
        id: createId(),
        sender,
        content,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const startCall = () => {
    const intro = `Hi, this is Nova calling on behalf of Manohar Kumar Sah. I'm reaching out to ${callContext.purpose.toLowerCase()}. For transparency, I'm taking light notes so Manohar can follow up without missing any details. Is now a good time to talk?`;
    setConversation([
      {
        id: createId(),
        sender: "assistant",
        content: intro,
        timestamp: new Date().toISOString(),
      },
    ]);
    setCallActive(true);
    setCallEnded(false);
    setElapsedSeconds(0);
    setClarificationsUsed(0);
    setNextPointIndex(0);
    setCoveredPoints(callContext.talkingPoints.map(() => false));
    setCallSummary(null);
    setCallLaunchedAt(new Date());
  };

  const handleTransfer = (reason: string) => {
    addMessage("note", `Escalated • ${reason}`);
    addMessage("assistant", "Let me connect you directly with Manohar.");
    setCallActive(false);
    setCallEnded(true);
  };

  const handleManualSilence = () => {
    handleTransfer("Caller remained silent for more than five seconds.");
  };

  const finalizeCall = () => {
    if (!callActive) return;
    addMessage(
      "assistant",
      "Thanks again for your time today. I'll brief Manohar right away so he can follow up directly.",
    );
    setCallActive(false);
    setCallEnded(true);
  };

  const processCallerInput = (content: string) => {
    const normalized = content.toLowerCase();

    if (
      normalized.includes("speak with manohar") ||
      normalized.includes("talk to manohar") ||
      normalized.includes("connect me with manohar") ||
      (normalized.includes("manohar") &&
        (normalized.includes("speak") ||
          normalized.includes("talk") ||
          normalized.includes("connect")))
    ) {
      handleTransfer("Caller requested Manohar directly.");
      return;
    }

    const containsKnownKeyword = topicKeywords.some((keyword) =>
      normalized.includes(keyword),
    );
    const isQuestion =
      normalized.includes("?") ||
      /\b(what|why|how|who|when|where|which|explain|clarify)\b/.test(
        normalized,
      );

    if (isQuestion && !containsKnownKeyword) {
      if (clarificationsUsed < clarificationResponses.length) {
        addMessage(
          "assistant",
          clarificationResponses[clarificationsUsed],
        );
        setClarificationsUsed((previous) => previous + 1);
        return;
      }
      handleTransfer("Caller asked for information beyond prepared context.");
      return;
    }

    if (nextPointIndex < callContext.talkingPoints.length) {
      const response = humanizeTalkingPoint(
        callContext.talkingPoints[nextPointIndex],
        nextPointIndex,
      );
      addMessage("assistant", response);
      setCoveredPoints((previous) =>
        previous.map((item, index) =>
          index === nextPointIndex ? true : item,
        ),
      );
      setNextPointIndex((previous) => previous + 1);
      return;
    }

    addMessage(
      "assistant",
      "Happy to keep things concise. Would you like me to schedule time with Manohar now, or should he follow up by email?",
    );
  };

  const handleCallerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!callActive) return;
    const trimmed = callerUtterance.trim();
    if (!trimmed) return;
    addMessage("caller", trimmed);
    setCallerUtterance("");
    processCallerInput(trimmed);
  };

  const handleGenerateSummary = () => {
    if (!callContext.consentToSummary) {
      setCallSummary(
        "Summary withheld — caller did not grant consent to capture post-call notes.",
      );
      return;
    }
    if (!callEnded) {
      setCallSummary("End the call first to capture an accurate summary.");
      return;
    }
    setCallSummary(buildSummary(callContext, conversation, coveredPoints));
  };

  const resetCall = () => {
    setConversation([]);
    setCallActive(false);
    setCallEnded(false);
    setElapsedSeconds(0);
    setClarificationsUsed(0);
    setNextPointIndex(0);
    setCoveredPoints(callContext.talkingPoints.map(() => false));
    setCallSummary(null);
    setCallLaunchedAt(null);
  };

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-lg">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Sparkles className="h-5 w-5 text-indigo-300" />
                <span>NovaCall · Real-time conversational assistant</span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Outbound Call Control Room
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                Keep conversations transparent, respectful, and on-script. Nova listens in real
                time, echoes the approved talking points, and hands off to Manohar the moment a
                human touch is required.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-4 text-sm text-indigo-100">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                <Activity className="h-4 w-4" />
                <span>{callActive ? "Live Call" : callEnded ? "Call Complete" : "Standby"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-semibold">
                  {formatSeconds(elapsedSeconds)}
                </span>
                <span className="text-xs text-indigo-200">
                  {callLaunchedAt
                    ? `since ${callLaunchedAt.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : "ready to dial"}
                </span>
              </div>
              <div className="flex gap-2 text-xs text-indigo-200">
                <div className="flex items-center gap-1 rounded-full border border-indigo-400/40 px-3 py-1">
                  <Mic className="h-3.5 w-3.5" />
                  <span>Live speech monitor</span>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-indigo-400/40 px-3 py-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>Script locked</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                  Call dossier
                </h2>
                <Phone className="h-4 w-4 text-indigo-300" />
              </div>
              <div className="mt-4 space-y-4 text-sm">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    Phone number
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/40"
                    value={callContext.phoneNumber}
                    onChange={(event) =>
                      setCallContext((previous) => ({
                        ...previous,
                        phoneNumber: event.target.value,
                      }))
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    Purpose
                  </span>
                  <textarea
                    className="mt-1 h-20 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/40"
                    value={callContext.purpose}
                    onChange={(event) =>
                      setCallContext((previous) => ({
                        ...previous,
                        purpose: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    Talking points (one per line)
                  </span>
                  <textarea
                    className="mt-1 h-40 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/40"
                    value={talkingPointsInput}
                    onChange={(event) => {
                      const value = event.target.value;
                      const parsed = parseList(value);
                      setTalkingPointsInput(value);
                      setCallContext((previous) => ({
                        ...previous,
                        talkingPoints: parsed,
                      }));
                      setCoveredPoints((previous) =>
                        parsed.map((_, index) => previous[index] ?? false),
                      );
                      setNextPointIndex((previous) =>
                        Math.min(previous, parsed.length),
                      );
                    }}
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    Handoff triggers (one per line)
                  </span>
                  <textarea
                    className="mt-1 h-28 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/40"
                    value={handoffInput}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHandoffInput(value);
                      setCallContext((previous) => ({
                        ...previous,
                        handoffConditions: parseList(value),
                      }));
                    }}
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-indigo-400 focus:ring-indigo-400"
                    checked={callContext.consentToSummary}
                    onChange={(event) =>
                      setCallContext((previous) => ({
                        ...previous,
                        consentToSummary: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    Caller consented to a post-call summary being captured for Manohar.
                  </span>
                </label>
              </div>
              <button
                type="button"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:bg-indigo-400 disabled:pointer-events-none disabled:opacity-60"
                onClick={startCall}
                disabled={callActive}
              >
                {callActive ? (
                  <>
                    <Headphones className="h-4 w-4" />
                    In progress
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4" />
                    Start call
                  </>
                )}
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                  Escalation rules
                </h3>
                <ShieldAlert className="h-4 w-4 text-rose-300" />
              </div>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                {callContext.handoffConditions.map((condition, index) => (
                  <li
                    key={`${condition}-${index.toString()}`}
                    className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-2"
                  >
                    <span className="mt-1 h-2 w-2 rounded-full bg-rose-300" />
                    <span>{condition}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleManualSilence}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/30"
              >
                <TimerReset className="h-4 w-4" />
                Mark 5s silence & transfer
              </button>
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-lg">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Live conversation</h2>
                <p className="text-xs text-white/60">
                  Nova mirrors the prepared talking points while monitoring for handoff triggers.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/70 transition hover:border-indigo-400/40 hover:text-indigo-100"
                  onClick={resetCall}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-50"
                  onClick={finalizeCall}
                  disabled={!callActive}
                >
                  Close call
                </button>
              </div>
            </div>
            <div
              ref={logRef}
              className="flex-1 space-y-4 overflow-y-auto px-6 py-6"
            >
              {conversation.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
                  <Mic className="mb-3 h-7 w-7 text-indigo-300" />
                  Waiting for the call to begin. Start the call to deliver the approved
                  introduction and track live responses automatically.
                </div>
              ) : (
                conversation.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-1 ${
                      message.sender === "assistant"
                        ? "items-end text-right"
                        : message.sender === "caller"
                          ? "items-start text-left"
                          : "items-center text-center"
                    }`}
                  >
                    <div
                      className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                        message.sender === "assistant"
                          ? "bg-indigo-500/20 text-indigo-50"
                          : message.sender === "caller"
                            ? "bg-white/10 text-white"
                            : "bg-white/5 text-white/70"
                      }`}
                    >
                      {message.content}
                    </div>
                    <span className="text-xs uppercase tracking-wide text-white/40">
                      {message.sender === "assistant"
                        ? "Nova"
                        : message.sender === "caller"
                          ? "Caller"
                          : "System"}
                      {" · "}
                      {displayTime(message.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={handleCallerSubmit}
              className="border-t border-white/5 px-6 py-5"
            >
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                Caller speech transcript
                <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/40">
                  simulated input
                </span>
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 focus-within:border-indigo-400/60 focus-within:ring-2 focus-within:ring-indigo-400/40">
                <textarea
                  className="h-20 flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder-white/30"
                  placeholder="Type what the caller just said..."
                  value={callerUtterance}
                  onChange={(event) => setCallerUtterance(event.target.value)}
                  disabled={!callActive}
                />
                <button
                  type="submit"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 transition hover:bg-indigo-400 disabled:pointer-events-none disabled:opacity-60"
                  disabled={!callActive}
                  aria-label="Submit caller utterance"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-xs text-white/50">
                Nova listens continuously. Provide transcribed snippets here to mirror what the
                caller said, and Nova will respond using the scripted talking points.
              </p>
            </form>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                  Script progress
                </h3>
                <ClipboardList className="h-4 w-4 text-emerald-300" />
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                {callContext.talkingPoints.map((point, index) => (
                  <li
                    key={`${point}-${index.toString()}`}
                    className={`rounded-2xl border px-3 py-3 ${
                      coveredPoints[index]
                        ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-50"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex-1">{point}</span>
                      <span
                        className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                          coveredPoints[index]
                            ? "border-emerald-300/60 bg-emerald-400/40 text-emerald-50"
                            : "border-white/15 text-white/40"
                        }`}
                      >
                        {coveredPoints[index] ? "✓" : index + 1}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                  Clarifications
                </h3>
                <UserRound className="h-4 w-4 text-sky-300" />
              </div>
              <p className="mt-3 text-sm text-white/70">
                Offer at most two clarifying prompts before handing off to Manohar.
              </p>
              <div className="mt-4 flex gap-2">
                {clarificationResponses.map((response, index) => (
                  <div
                    key={response}
                    className={`flex-1 rounded-2xl border px-3 py-3 text-xs ${
                      clarificationsUsed > index
                        ? "border-sky-400/40 bg-sky-500/20 text-sky-50"
                        : "border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    {response}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs font-medium text-white/70 transition hover:border-indigo-400/40 hover:text-indigo-100"
                onClick={() =>
                  addMessage(
                    "note",
                    "Logged: Caller requested clarification, Nova responded with the approved prompt.",
                  )
                }
              >
                Document clarification
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                  Post-call summary
                </h3>
                <Sparkles className="h-4 w-4 text-violet-300" />
              </div>
              <p className="mt-3 text-sm text-white/70">
                Generate a digest for Manohar once the call wraps up. Respect caller privacy
                choices at all times.
              </p>
              <button
                type="button"
                onClick={handleGenerateSummary}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20"
              >
                <ClipboardList className="h-4 w-4" />
                Generate summary
              </button>
              <div className="mt-4 min-h-[160px] rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-xs leading-relaxed text-white/70">
                {callSummary ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-white/80">
                    {callSummary}
                  </pre>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-white/40">
                    Summary will appear here once generated.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
