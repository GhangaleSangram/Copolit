import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptySettings, type InterviewSettings } from "@/lib/interview-settings";
import { toast } from "sonner";

export function SettingsDialog({
  settings,
  onSave,
  open,
  onOpenChange,
}: {
  settings: InterviewSettings;
  onSave: (next: InterviewSettings) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<InterviewSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const update = (key: keyof InterviewSettings, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings" className="rounded-full">
          <Settings2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="hud-panel max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Interview context</DialogTitle>
          <DialogDescription>
            Paste your resume, the job description and company details. Every answer is written
            from this context, in your voice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="e.g. Stripe"
                value={draft.company}
                onChange={(e) => update("company", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                placeholder="e.g. Senior Frontend Engineer"
                value={draft.role}
                onChange={(e) => update("role", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resume">Resume</Label>
            <Textarea
              id="resume"
              rows={8}
              placeholder="Paste your full resume text here..."
              value={draft.resume}
              onChange={(e) => update("resume", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jd">Job description</Label>
            <Textarea
              id="jd"
              rows={7}
              placeholder="Paste the job posting..."
              value={draft.jobDescription}
              onChange={(e) => update("jobDescription", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Company details & notes</Label>
            <Textarea
              id="notes"
              rows={4}
              placeholder="Products, team, interviewer names, anything you want mentioned..."
              value={draft.extraNotes}
              onChange={(e) => update("extraNotes", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Keyboard shortcuts</Label>
            <div className="grid gap-1.5 rounded-xl border border-border p-3 text-sm sm:grid-cols-2">
              {[
                ["Ctrl/⌘ + Enter", "Answer the current question"],
                ["Ctrl/⌘ + Shift + Enter", "Screenshot & answer"],
                ["Ctrl/⌘ + Shift + Space", "Focus the chat box"],
                ["Ctrl/⌘ + Shift + Backspace", "Clear captured text"],
                ["Ctrl/⌘ + Shift + L", "Start / stop listening"],
                ["Enter (in chat box)", "Send message"],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{d}</span>
                  <span className="hud-key font-mono text-xs whitespace-nowrap">{k}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Listening captures system audio (the interviewer), not your mic. When the share
              window opens, pick the meeting tab or "Entire screen" and turn on "Share audio".
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(emptySettings);
            }}
          >
            Clear all
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
              toast.success("Context saved");
            }}
          >
            Save context
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
