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
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Person {
  id: number;
  name: string;
  company: string | null;
}

interface ProcessResult {
  meeting: {
    id: number;
    summary: string;
    topics: string[];
  };
  person: {
    id: number;
    name: string;
  };
  extraction: {
    name: string;
    summary: string;
    topics: string[];
  };
  isNewPerson: boolean;
}

export default function LogPage() {
  const [text, setText] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/persons")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPeople(data);
      })
      .catch(() => {});

    // Check speech support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.SpeechRecognition || w.webkitSpeechRecognition) {
      setSpeechSupported(true);
    }
  }, []);

  function toggleVoice() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition is not supported in your browser");
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
      console.error("Speech recognition error:", event.error);
      setRecording(false);
      if (event.error !== "aborted") {
        toast.error(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
    toast.info("🎤 Listening... Speak your meeting notes");
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setRecording(false);
  }

  async function processMeeting() {
    if (!text.trim()) {
      toast.error("Please enter some meeting notes");
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/meetings/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          personId: personId && personId !== "auto" ? parseInt(personId) : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Processing failed");
      }

      const data = await res.json();
      setResult(data);
      toast.success(
        data.isNewPerson
          ? `Meeting logged! Created new contact: ${data.person.name}`
          : `Meeting logged with ${data.person.name}`
      );
    } catch (e) {
      console.error("Processing error:", e);
      toast.error("Failed to process meeting. Check your settings.");
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    setText("");
    setPersonId("");
    setResult(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Log Meeting</h1>
        <p className="text-muted-foreground mt-1">
          Record meeting notes — type or use voice input. AI will extract contacts and topics.
        </p>
      </div>

      {!result ? (
        <div className="space-y-4">
          {/* Optional person selector */}
          <div className="space-y-2">
            <Label>Person (optional — AI will auto-detect)</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect from notes..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} {p.company ? `(${p.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text area */}
          <div className="space-y-2">
            <Label>Meeting Notes</Label>
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Describe your meeting, e.g. "Had coffee with Sarah Chen from TechCorp. We discussed their new AI infrastructure project..."'
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
                  {recording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {recording && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Recording... Click the mic button to stop
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {text.length} characters
              {!speechSupported && " • Voice input not supported in this browser"}
            </p>
          </div>

          {/* Process button */}
          <Button
            onClick={processMeeting}
            disabled={!text.trim() || processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Process Meeting
              </>
            )}
          </Button>

          {/* Tips */}
          <Card className="bg-accent/50">
            <CardContent className="pt-4 pb-4">
              <h3 className="font-medium text-sm mb-2">💡 Tips for best results</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Mention people by their full name for better matching</li>
                <li>• Include company names and topics discussed</li>
                <li>• Describe the context: coffee chat, meeting, call, event, etc.</li>
                <li>• The more detail you provide, the richer the AI-generated profile</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Results */
        <div className="space-y-4">
          <Card className="border-green-500/50">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-green-500 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Meeting Logged Successfully
              </div>

              {/* Person */}
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Link
                    href={`/people/${result.person.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {result.person.name}
                  </Link>
                  {result.isNewPerson && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      New Contact
                    </Badge>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div>
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">
                  {result.extraction.summary}
                </p>
              </div>

              {/* Topics */}
              {result.extraction.topics.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Topics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.extraction.topics.map((topic) => (
                      <Badge key={topic} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={reset} className="flex-1">
              <Send className="mr-2 h-4 w-4" />
              Log Another Meeting
            </Button>
            <Link href={`/people/${result.person.id}`}>
              <Button variant="outline">View Contact</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
