import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 14 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "AI is not configured." }, { status: 500 });
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) {
          return Response.json({ error: "Invalid audio." }, { status: 400 });
        }
        const upstream = new FormData();
        upstream.append("model", "google/gemini-3.5-transcribe");
        upstream.append("file", new Blob([await file.arrayBuffer()], { type: "audio/wav" }), "clip.wav");
        upstream.append("response_format", "json");
        upstream.append("language", "en");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        if (!res.ok) {
          let message = "Transcription failed.";
          try {
            const j = (await res.json()) as any;
            message = j?.error?.message ?? j?.message ?? message;
          } catch {
            /* noop */
          }
          return Response.json({ error: message }, { status: res.status });
        }
        const data = (await res.json()) as { text?: string };
        return Response.json({ text: (data.text ?? "").trim() });
      },
    },
  },
});
