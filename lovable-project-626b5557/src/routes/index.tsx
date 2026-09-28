import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CircleStop,
  Command,
  CornerDownLeft,
  Loader2,
  Maximize2,
  Mic,
  MoreVertical,
  Move,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/interview/settings-dialog";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { streamAnswer, type ChatMessage } from "@/lib/ask-ai";
import {
  emptySettings,
  isSettingsFilled,
  loadSettings,
  saveSettings,
  type InterviewSettings,
} from "@/lib/interview-settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EchoPrep — Live Interview Assistant" },
      {
        name: "description",
        content:
          "A floating interview copilot that listens to the question and answers instantly from your resume, the job description and the company.",
      },
      { property: "og:title", content: "EchoPrep — Live Interview Assistant" },
      {
        property: "og:description",
        content:
          "Real-time interview answers written in your voice, grounded in your resume and the role you are interviewing for.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function Keys({ children }: { children: React.ReactNode }) {
  return <span className="hud-key font-mono">{children}</span>;
}

function Index() {
  const [settings, setSettings] = useState<InterviewSettings>(emptySettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const speech = useSpeechRecognition((msg) => toast.error(msg));

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (speech.transcript) setMessage(speech.transcript);
  }, [speech.transcript]);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ask = useCallback(
    async (question: string, imageDataUrl?: string) => {
      if (!question.trim() && !imageDataUrl) {
        toast.error("Nothing to answer yet — speak or type a question.");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setAnswer("");
      const history = thread.slice(-6);
      try {
        await streamAnswer({
          question: question.trim() || "Answer the interview question shown in this screenshot.",
          imageDataUrl,
          mode: "answer",
          settings,
          history,
          signal: controller.signal,
          onDelta: (delta) => setAnswer((prev) => prev + delta),
        });
        setThread((prev) => [...prev, { role: "user", content: question.trim() }]);
      } catch (error) {
        if (controller.signal.aborted) return;
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [settings, thread],
  );

  useEffect(() => {
    setThread((prev) => {
      if (!answer || loading) return prev;
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && last.content === answer) return prev;
      if (last?.role !== "user") return prev;
      return [...prev, { role: "assistant", content: answer }];
    });
  }, [answer, loading]);

  const captureScreenshot = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = media;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      media.getTracks().forEach((t) => t.stop());
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      await ask(message, dataUrl);
      setMessage("");
    } catch {
      toast.error("Screen capture was cancelled or is not allowed in this browser.");
    }
  }, [ask, message]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void ask(message.trim() || speech.transcript);
      }
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        void captureScreenshot();
      }
      if (event.code === "Space" && event.shiftKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key.toLowerCase() === "l" && event.shiftKey) {
        event.preventDefault();
        if (speech.listening) speech.stop();
        else void speech.start();
      }
      if (event.key === "Backspace" && event.shiftKey) {
        event.preventDefault();
        speech.clear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask, captureScreenshot, message, speech]);

  const contextReady = isSettingsFilled(settings);

  const send = () => {
    const q = message.trim() || speech.transcript;
    void ask(q);
    setMessage("");
    speech.clear();
  };

  return (
    <main className="grid-backdrop min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {/* Top HUD toolbar */}
        <div className="hud-bar flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-1 pr-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={speech.listening ? "Stop listening" : "Start listening"}
              className="rounded-full"
              onClick={() => (speech.listening ? speech.stop() : void speech.start())}
            >
              {speech.listening ? (
                <CircleStop className="size-4 text-destructive" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Capture screen"
              className="rounded-full"
              onClick={() => void captureScreenshot()}
            >
              <Camera className="size-4" />
            </Button>
          </div>

          <Button
            variant="secondary"
            className="h-9 rounded-full px-4 font-display"
            onClick={() => void ask(message.trim() || speech.transcript)}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Answer
            <Keys>
              <Command className="size-3" />
              <CornerDownLeft className="size-3" />
            </Keys>
          </Button>

          <Button
            variant="secondary"
            className="h-9 rounded-full px-4 font-display"
            onClick={() => void captureScreenshot()}
          >
            Screenshot
            <Keys>
              <Command className="size-3" />⇧
              <CornerDownLeft className="size-3" />
            </Keys>
          </Button>

          <Button
            variant="secondary"
            className="h-9 rounded-full px-4 font-display"
            onClick={() => inputRef.current?.focus()}
          >
            Chat
            <Keys>
              <Command className="size-3" />⇧␣
            </Keys>
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Move" className="rounded-full">
              <Move className="size-4" />
            </Button>
            <SettingsDialog
              settings={settings}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              onSave={(next) => {
                setSettings(next);
                saveSettings(next);
              }}
            />
            <Button variant="ghost" size="icon" aria-label="More" className="rounded-full">
              <MoreVertical className="size-4" />
            </Button>
            <span className="ml-1 rounded-full bg-live px-3 py-1.5 font-mono text-sm text-live-foreground">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>

        {/* Unified composer: mic + live transcript + typing */}
        <div className="hud-bar flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            aria-label={speech.listening ? "Stop listening" : "Start listening"}
            onClick={() => (speech.listening ? speech.stop() : void speech.start())}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center gap-[3px] rounded-full transition-colors",
              speech.listening ? "bg-destructive/20" : "bg-accent hover:bg-accent/80",
            )}
          >
            {speech.listening ? (
              [0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-destructive transition-all"
                  style={{ height: `${6 + Math.min(1, speech.level * 4) * (10 + i * 3)}px` }}
                />
              ))
            ) : (
              <Mic className="size-4" />
            )}
          </button>
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              speech.setTranscript(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              speech.listening
                ? speech.transcribing
                  ? "Converting speech to text..."
                  : "Listening to system audio..."
                : "Tap to capture system audio, or type..."
            }
            className="h-10 min-w-0 flex-1 bg-transparent px-2 text-base text-hud-foreground outline-none placeholder:text-muted-foreground"
          />
          {speech.transcribing && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Capture screen"
            className="rounded-full"
            onClick={() => void captureScreenshot()}
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button className="h-9 rounded-full px-4" disabled={loading} onClick={send}>
            Send
            <CornerDownLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear"
            className="rounded-full"
            onClick={() => {
              abortRef.current?.abort();
              setAnswer("");
              setLoading(false);
              setMessage("");
              speech.clear();
            }}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Answer panel */}
        <section className="hud-panel rounded-3xl p-5">
          <header className="mb-3 flex items-center justify-between">
            <h1 className="font-display text-sm tracking-wide text-muted-foreground uppercase">
              Answer
            </h1>
            {!contextReady && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Add your resume for tailored answers
              </button>
            )}
          </header>

          {answer ? (
            <div className="text-[0.98rem] leading-relaxed whitespace-pre-wrap text-hud-foreground">
              {answer}
              {loading && <span className="ml-1 animate-pulse">▍</span>}
            </div>
          ) : loading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Thinking through your answer...
            </p>
          ) : (
            <p className="text-muted-foreground">
              Start listening, type a question, or capture the screen. Your answer appears here in
              seconds, written from your resume and the role you are interviewing for.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
