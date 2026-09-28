import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
} from "@/lib/run-id";

const bodySchema = z.object({
  question: z.string().default(""),
  imageDataUrl: z.string().optional(),
  mode: z.enum(["answer", "chat"]).default("answer"),
  resume: z.string().default(""),
  jobDescription: z.string().default(""),
  company: z.string().default(""),
  role: z.string().default(""),
  extraNotes: z.string().default(""),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
});

function buildSystemPrompt(data: z.infer<typeof bodySchema>) {
  const profile = [
    data.company ? `Company: ${data.company}` : "",
    data.role ? `Target role: ${data.role}` : "",
    data.jobDescription ? `Job description:\n${data.jobDescription}` : "",
    data.resume ? `Candidate resume:\n${data.resume}` : "",
    data.extraNotes ? `Extra notes:\n${data.extraNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    "You are a real-time interview assistant. The candidate is in a live interview and reads your reply out loud, so speed and clarity matter.",
    "Rules: answer in first person as the candidate. Lead with a direct 2-3 sentence answer, then 3-5 short bullets with specifics. Use concrete details from the resume and tailor to the job description and company when relevant. Never invent experience that is not in the resume. For coding questions, give a short approach, then a clean code block, then time and space complexity.",
    "Keep the whole reply under about 200 words unless code is required.",
    profile ? `Candidate context:\n\n${profile}` : "No candidate context has been saved yet; answer generically and briefly note that adding a resume in Settings gives tailored answers.",
  ].join("\n\n");
}

export const Route = createFileRoute("/api/answer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return new Response("Invalid request", { status: 400 });
        }
        const data = parsed.data;
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI is not configured", { status: 401 });
        }

        const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));

        try {
          const response = await gateway.fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            signal: request.signal,
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              stream: true,
              store: false,
              reasoning: { effort: "low", summary: "auto" },
              include: ["reasoning.encrypted_content"],
              input: [
                { role: "system", content: buildSystemPrompt(data) },
                ...data.history.map((m) => ({ role: m.role, content: m.content })),
                {
                  role: "user",
                  content: data.imageDataUrl
                    ? [
                        { type: "input_text", text: data.question },
                        { type: "input_image", image_url: data.imageDataUrl },
                      ]
                    : data.question,
                },
              ],
            }),
          });

          if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => "");
            return new Response(detail || "AI request failed", { status: response.status });
          }

          const headers = getLovableAiGatewayResponseHeaders(response.headers);
          headers.set("Content-Type", "text/event-stream");
          headers.set("Cache-Control", "no-cache, no-transform");
          return new Response(response.body, { status: 200, headers });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw error;
        }
      },
    },
  },
});
