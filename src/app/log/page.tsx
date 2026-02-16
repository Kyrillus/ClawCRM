"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  CheckCircle2,
  User,
  Tag,
  Sparkles,
  X,
  Plus,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Person {
  id: number;
  name: string;
  company: string | null;
  role: string | null;
}

interface PersonMatch {
  extractedName: string;
  bestMatch: Person | null;
  candidates: (Person & { score: number })[];
  confidence: number;
  isNew: boolean;
}

interface PreviewResult {
  extraction: {
    names: string[];
    summary: string;
    topics: string[];
  };
  matches: PersonMatch[];
}

interface Assignment {
  extractedName: string;
  personId?: number;
  createNew: boolean;
  selectedOption: string; // "new" | person id as string
}

interface LinkedPerson {
  id: number;
  name: string;
  isNew: boolean;
}

type Step = "input" | "review" | "success";

export default function LogPage() {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // All existing people for dropdowns
  const [allPeople, setAllPeople] = useState<Person[]>([]);

  // Review state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Success state
  const [linkedPeople, setLinkedPeople] = useState<LinkedPerson[]>([]);
  const [meetingId, setMeetingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/persons")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllPeople(data);
      })
      .catch(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.SpeechRecognition || w.webkitSpeechRecognition) {
      setSpeechSupported(true);
    }
  }, []);

  // --- Voice ---
  function toggleVoice() {
    if (recording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setRecording(false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SpeechRecognitionAPI =
        w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        toast.error("Speech recognition not supported");
        return;
      }
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = text;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += " " + transcript;
            setText(finalTranscript.trim());
          } else {
            interim += transcript;
          }
        }
        setText((finalTranscript + " " + interim).trim());
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setRecording(false);
        if (event.error !== "aborted") toast.error(`Voice error: ${event.error}`);
      };
      recognition.onend = () => setRecording(false);
      recognition.start();
      recognitionRef.current = recognition;
      setRecording(true);
      toast.info("🎤 Listening...");
    }
  }

  // --- Step 1: Process ---
  async function processMeeting() {
    if (!text.trim()) {
      toast.error("Please enter some meeting notes");
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch("/api/meetings/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error("Processing failed");
      const data: PreviewResult = await res.json();
      setPreview(data);
      setEditSummary(data.extraction.summary);
      setEditTopics([...data.extraction.topics]);

      // Build assignments from matches
      const newAssignments: Assignment[] = data.matches.map((match) => ({
        extractedName: match.extractedName,
        personId: match.bestMatch?.id,
        createNew: !match.bestMatch,
        selectedOption: match.bestMatch ? String(match.bestMatch.id) : "new",
      }));
      setAssignments(newAssignments);
      setStep("review");
    } catch {
      toast.error("Failed to process meeting");
    } finally {
      setProcessing(false);
    }
  }

  // --- Step 2: Review helpers ---
  function updateAssignment(index: number, option: string) {
    setAssignments((prev) => {
      const next = [...prev];
      if (option === "new") {
        next[index] = {
          ...next[index],
          selectedOption: "new",
          createNew: true,
          personId: undefined,
        };
      } else {
        const pid = parseInt(option);
        next[index] = {
          ...next[index],
          selectedOption: option,
          createNew: false,
          personId: pid,
        };
      }
      return next;
    });
  }

  function removeAssignment(index: number) {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  }

  function addPerson() {
    setAssignments((prev) => [
      ...prev,
      {
        extractedName: "",
        createNew: true,
        selectedOption: "new",
        personId: undefined,
      },
    ]);
  }

  function updateExtractedName(index: number, name: string) {
    setAssignments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], extractedName: name };
      return next;
    });
  }

  function removeTopic(topic: string) {
    setEditTopics((prev) => prev.filter((t) => t !== topic));
  }

  function addTopic() {
    if (newTopicInput.trim() && !editTopics.includes(newTopicInput.trim())) {
      setEditTopics((prev) => [...prev, newTopicInput.trim()]);
      setNewTopicInput("");
    }
  }

  // --- Step 2: Confirm ---
  async function confirmMeeting() {
    if (assignments.length === 0) {
      toast.error("Add at least one person");
      return;
    }
    const emptyNew = assignments.some((a) => a.createNew && !a.extractedName.trim());
    if (emptyNew) {
      toast.error("Please enter a name for all new people");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/meetings/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          text: text.trim(),
          summary: editSummary,
          topics: editTopics,
          assignments: assignments.map((a) => ({
            extractedName: a.extractedName,
            personId: a.createNew ? undefined : a.personId,
            createNew: a.createNew,
            newName: a.createNew ? a.extractedName : undefined,
          })),
        }),
      });
      if (!res.ok) throw new Error("Confirm failed");
      const data = await res.json();
      setLinkedPeople(data.linkedPeople);
      setMeetingId(data.meeting.id);
      setStep("success");
      toast.success("Meeting logged!");
    } catch {
      toast.error("Failed to save meeting");
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setText("");
    setStep("input");
    setPreview(null);
    setAssignments([]);
    setEditSummary("");
    setEditTopics([]);
    setLinkedPeople([]);
    setMeetingId(null);
  }

  // --- RENDER ---
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Log Meeting</h1>
        <p className="text-muted-foreground mt-1">
          {step === "input" && "Record meeting notes — type or use voice. AI extracts contacts and topics."}
          {step === "review" && "Review and correct the AI's extraction before saving."}
          {step === "success" && "Meeting saved successfully!"}
        </p>
      </div>

      {/* ===== STEP 1: INPUT ===== */}
      {step === "input" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Meeting Notes</Label>
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='e.g. "Had coffee with Sarah Chen and David Kim. We discussed their AI infrastructure project and potential collaboration..."'
                rows={8}
                className={`resize-none pr-12 ${recording ? "border-red-500" : ""}`}
              />
              {speechSupported && (
                <Button
                  type="button"
                  variant={recording ? "destructive" : "ghost"}
                  size="icon"
                  className="absolute right-2 bottom-2"
                  onClick={toggleVoice}
                >
                  {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
            </div>
            {recording && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Recording... Click mic to stop
              </div>
            )}
            <p className="text-xs text-muted-foreground">{text.length} characters</p>
          </div>

          <Button onClick={processMeeting} disabled={!text.trim() || processing} className="w-full" size="lg">
            {processing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing with AI...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Process Meeting</>
            )}
          </Button>

          <Card className="bg-accent/50">
            <CardContent className="pt-4 pb-4">
              <h3 className="font-medium text-sm mb-2">💡 Tips</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Mention multiple people — AI will detect all of them</li>
                <li>• Use full names for better matching</li>
                <li>• Include companies and topics discussed</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP 2: REVIEW ===== */}
      {step === "review" && preview && (
        <div className="space-y-5">
          {/* Summary */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <Label className="text-sm font-medium">Summary</Label>
                <Textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              {/* Topics */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> Topics
                </Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {editTopics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="gap-1 pr-1">
                      {topic}
                      <button
                        onClick={() => removeTopic(topic)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add topic..."
                    value={newTopicInput}
                    onChange={(e) => setNewTopicInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={addTopic}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* People Assignments */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> People ({assignments.length})
                </Label>
                <Button variant="outline" size="sm" onClick={addPerson} className="gap-1">
                  <UserPlus className="h-3.5 w-3.5" /> Add Person
                </Button>
              </div>

              {assignments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No people detected. Add someone manually.
                </p>
              )}

              {assignments.map((assignment, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {assignment.extractedName
                        ? `Detected: "${assignment.extractedName}"`
                        : "Manual addition"}
                      {assignment.selectedOption !== "new" && preview.matches[index]?.confidence
                        ? ` (${Math.round(preview.matches[index].confidence * 100)}% match)`
                        : ""}
                    </p>
                    <Select
                      value={assignment.selectedOption}
                      onValueChange={(val) => updateAssignment(index, val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select person..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">
                          ✨ Create new person
                        </SelectItem>
                        {/* Show candidates first if available */}
                        {preview.matches[index]?.candidates?.map((c) => (
                          <SelectItem key={`cand-${c.id}`} value={String(c.id)}>
                            {c.name} {c.company ? `(${c.company})` : ""} — {Math.round(c.score * 100)}%
                          </SelectItem>
                        ))}
                        {/* Then all other people not in candidates */}
                        {allPeople
                          .filter(
                            (p) =>
                              !preview.matches[index]?.candidates?.some((c) => c.id === p.id)
                          )
                          .map((p) => (
                            <SelectItem key={`all-${p.id}`} value={String(p.id)}>
                              {p.name} {p.company ? `(${p.company})` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {assignment.selectedOption === "new" && (
                      <Input
                        placeholder="Enter person's name..."
                        value={assignment.extractedName}
                        onChange={(e) => updateExtractedName(index, e.target.value)}
                        className="mt-1.5"
                        autoFocus
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAssignment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep("input")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Edit
            </Button>
            <Button
              onClick={confirmMeeting}
              disabled={confirming || assignments.length === 0}
              className="flex-1 gap-2"
              size="lg"
            >
              {confirming ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Confirm & Save</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: SUCCESS ===== */}
      {step === "success" && (
        <div className="space-y-4">
          <Card className="border-green-500/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-green-500 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Meeting Logged Successfully
              </div>

              {/* Linked People */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> People ({linkedPeople.length})
                </p>
                <div className="space-y-2">
                  {linkedPeople.map((person) => (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{person.name}</span>
                      {person.isNew && (
                        <Badge variant="outline" className="text-xs">New</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div>
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">{editSummary}</p>
              </div>

              {/* Topics */}
              {editTopics.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Topics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {editTopics.map((topic) => (
                      <Badge key={topic} variant="secondary">{topic}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={reset} className="flex-1 gap-2">
              <Send className="h-4 w-4" /> Log Another Meeting
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
