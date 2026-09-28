import type { InterviewSettings } from "@/lib/interview-settings";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function streamAnswer(options: {
  question: string;
  imageDataUrl?: string | undefined;
  mode: "answer" | "chat";
  settings: InterviewSettings;
  history?: ChatMessage[];
  signal?: AbortSignal | undefined;
  onDelta: (text: string) => void;
}) {
  const response = await fetch("/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal ?? null,
    body: JSON.stringify({
      question: options.question,
      imageDataUrl: options.imageDataUrl,
      mode: options.mode,
      history: options.history ?? [],
      ...options.settings,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("Too many requests right now. Try again shortly.");
    if (response.status === 402) throw new Error("AI credits are exhausted. Add credits to continue.");
    throw new Error(detail?.slice(0, 200) || "The assistant could not answer.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload);
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            options.onDelta(event.delta);
          }
          if (event.type === "error" || event.type === "response.failed") {
            throw new Error(event.error?.message ?? "The assistant stopped unexpectedly.");
          }
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
    }
  }
}
