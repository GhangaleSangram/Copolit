import { useCallback, useEffect, useRef, useState } from "react";

const SEGMENT_MS = 2500;

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, length * 2, true);
  let o = 44;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i += 1) {
      const s = Math.max(-1, Math.min(1, c[i] ?? 0));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Records the microphone and transcribes it in ~5s segments with AI. */
export function useSpeechRecognition(onError?: (msg: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const peakRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    setSupported(!!navigator.mediaDevices?.getUserMedia);
  }, []);

  const flush = useCallback(() => {
    const ctx = ctxRef.current;
    const chunks = chunksRef.current;
    const peak = peakRef.current;
    chunksRef.current = [];
    peakRef.current = 0;
    if (!ctx || !chunks.length || peak < 0.01) return; // silence
    const blob = encodeWav(chunks, ctx.sampleRate);
    pendingRef.current += 1;
    setTranscribing(true);
    queueRef.current = queueRef.current.then(async () => {
      try {
        const form = new FormData();
        form.append("file", blob, "clip.wav");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
        const text = data.text?.trim();
        if (text) setTranscript((prev) => (prev ? `${prev} ${text}` : text));
      } catch (e) {
        onErrorRef.current?.(e instanceof Error ? e.message : "Transcription failed.");
      } finally {
        pendingRef.current -= 1;
        if (pendingRef.current === 0) setTranscribing(false);
      }
    });
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    flush();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setListening(false);
    setLevel(0);
  }, [flush]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // @ts-expect-error chrome-only hint to offer system audio
        systemAudio: "include",
      });
      display.getVideoTracks().forEach((t) => t.stop());
      const audioTracks = display.getAudioTracks();
      if (!audioTracks.length) {
        onErrorRef.current?.('No audio shared. Pick the meeting tab or "Entire screen" and turn on "Share audio".');
        return;
      }
      const stream = new MediaStream(audioTracks);
      audioTracks[0]?.addEventListener("ended", () => stopRef.current());
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => {
        const data = new Float32Array(e.inputBuffer.getChannelData(0));
        chunksRef.current.push(data);
        let max = 0;
        for (let i = 0; i < data.length; i += 1) max = Math.max(max, Math.abs(data[i] ?? 0));
        peakRef.current = Math.max(peakRef.current, max);
        setLevel(max);
      };
      source.connect(proc);
      proc.connect(ctx.destination);
      streamRef.current = stream;
      ctxRef.current = ctx;
      chunksRef.current = [];
      peakRef.current = 0;
      timerRef.current = window.setInterval(flush, SEGMENT_MS);
      setListening(true);
    } catch {
      onErrorRef.current?.(
        "System audio sharing was cancelled or isn't allowed here. Open the app in its own Chrome tab and try again.",
      );
    }
  }, [flush]);

  useEffect(() => () => stopRef.current(), []);

  const clear = useCallback(() => setTranscript(""), []);

  return { supported, listening, transcribing, level, transcript, start, stop, clear, setTranscript };
}
