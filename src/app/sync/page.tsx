"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  MessageSquare,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Clock,
  ArrowLeft,
  RefreshCw,
  X,
  Eye,
  Wifi,
  WifiOff,
  QrCode,
  LogOut,
  Power,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PreviewData {
  chatName: string;
  participants: string[];
  totalMessages: number;
  days: number;
  dateRange: { from: string; to: string } | null;
  segments: {
    date: string;
    messageCount: number;
    participants: string[];
    preview: string;
  }[];
}

interface SyncResult {
  success: boolean;
  contactsSynced: number;
  messagesSynced: number;
  meetingsCreated: number;
  newPeople: string[];
  matchedPeople: string[];
  errors: string[];
}

interface SyncLogEntry {
  id: number;
  timestamp: string;
  type: string;
  contactsSynced: number;
  messagesSynced: number;
  errors: string | null;
  status: string;
  details: string | null;
}

interface WAClientStatus {
  status: "disconnected" | "qr_pending" | "connecting" | "ready" | "error";
  qrCode: string | null;
  connectedNumber: string | null;
  connectedName: string | null;
  error: string | null;
  messagesSynced: number;
}

type Tab = "live" | "import" | "history";

// ─── Live Sync Section ───────────────────────────────────────
function LiveSyncSection() {
  const [clientStatus, setClientStatus] = useState<WAClientStatus | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [contactSyncResult, setContactSyncResult] = useState<{
    synced: number;
    created: number;
    errors: string[];
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/whatsapp/client");
      const data: WAClientStatus = await res.json();
      setClientStatus(data);
    } catch {
      // Ignore fetch errors during polling
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function doAction(action: string) {
    setActionLoading(action);
    setContactSyncResult(null);
    try {
      const res = await fetch("/api/sync/whatsapp/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (action === "sync-contacts" && data.ok) {
        setContactSyncResult({ synced: data.synced, created: data.created, errors: data.errors });
        toast.success(`Synced ${data.synced} contacts (${data.created} new)`);
      } else if (action === "start") {
        toast.success("WhatsApp client starting...");
      } else if (action === "stop") {
        toast.success("Disconnected");
      } else if (action === "logout") {
        toast.success("Logged out");
      }

      // Refresh status immediately
      await fetchStatus();
    } catch {
      toast.error(`Action "${action}" failed`);
    } finally {
      setActionLoading(null);
    }
  }

  const status = clientStatus?.status || "disconnected";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            WhatsApp Connection
          </CardTitle>
          <CardDescription>
            Connect your WhatsApp to automatically sync messages and contacts into the CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                status === "ready"
                  ? "bg-green-500 animate-pulse"
                  : status === "qr_pending" || status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : status === "error"
                  ? "bg-red-500"
                  : "bg-gray-400"
              }`}
            />
            <span className="text-sm font-medium capitalize">
              {status === "qr_pending" ? "Waiting for QR scan" : status.replace("_", " ")}
            </span>
            {clientStatus?.connectedName && (
              <Badge variant="secondary">
                {clientStatus.connectedName} ({clientStatus.connectedNumber})
              </Badge>
            )}
            {clientStatus?.messagesSynced ? (
              <Badge variant="outline" className="ml-auto">
                {clientStatus.messagesSynced} messages synced
              </Badge>
            ) : null}
          </div>

          {/* Error display */}
          {clientStatus?.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              {clientStatus.error}
            </div>
          )}

          {/* QR Code */}
          {status === "qr_pending" && clientStatus?.qrCode && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground text-center">
                Scan this QR code with WhatsApp on your phone
              </p>
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={clientStatus.qrCode}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
            </div>
          )}

          {/* Connecting spinner */}
          {status === "connecting" && !clientStatus?.qrCode && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Starting WhatsApp client...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {(status === "disconnected" || status === "error") && (
              <Button
                onClick={() => doAction("start")}
                disabled={actionLoading !== null}
                className="gap-2"
              >
                {actionLoading === "start" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                Connect WhatsApp
              </Button>
            )}

            {status === "ready" && (
              <>
                <Button
                  onClick={() => doAction("sync-contacts")}
                  disabled={actionLoading !== null}
                  variant="outline"
                  className="gap-2"
                >
                  {actionLoading === "sync-contacts" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Sync All Contacts
                </Button>

                <Button
                  onClick={() => doAction("stop")}
                  disabled={actionLoading !== null}
                  variant="outline"
                  className="gap-2"
                >
                  {actionLoading === "stop" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  Disconnect
                </Button>

                <Button
                  onClick={() => doAction("logout")}
                  disabled={actionLoading !== null}
                  variant="ghost"
                  className="gap-2 text-red-400 hover:text-red-300"
                >
                  {actionLoading === "logout" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Logout
                </Button>
              </>
            )}

            {(status === "qr_pending" || status === "connecting") && (
              <Button
                onClick={() => doAction("stop")}
                disabled={actionLoading !== null}
                variant="outline"
                className="gap-2"
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>

          {/* Ready info */}
          {status === "ready" && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
              <CheckCircle2 className="h-4 w-4 inline mr-2 text-green-500" />
              Auto-sync is active. New WhatsApp messages are automatically synced to the CRM.
            </div>
          )}

          {/* Contact sync result */}
          {contactSyncResult && (
            <div className="p-3 rounded-lg bg-secondary text-sm space-y-1">
              <p className="font-medium">Contact Sync Complete</p>
              <p className="text-muted-foreground">
                {contactSyncResult.synced} contacts synced ({contactSyncResult.created} new)
              </p>
              {contactSyncResult.errors.length > 0 && (
                <p className="text-red-400 text-xs">
                  {contactSyncResult.errors.length} errors
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function SyncPage() {
  const [tab, setTab] = useState<Tab>("live");
  const [pasteContent, setPasteContent] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/sync/whatsapp");
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      toast.error("Failed to load sync history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt")) {
      toast.error("Please upload a .txt file (WhatsApp chat export)");
      return;
    }

    setLoading(true);
    setSyncResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "preview");

      const res = await fetch("/api/sync/whatsapp", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Preview failed");
      const data: PreviewData = await res.json();
      setPreview(data);
      const content = await file.text();
      setPasteContent(content);
      toast.success(`Parsed "${data.chatName}" — ${data.totalMessages} messages`);
    } catch {
      toast.error("Failed to parse file");
    } finally {
      setLoading(false);
    }
  }

  async function handlePastePreview() {
    if (!pasteContent.trim()) {
      toast.error("Paste WhatsApp chat export content first");
      return;
    }

    setLoading(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/sync/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", content: pasteContent }),
      });

      if (!res.ok) throw new Error("Preview failed");
      const data: PreviewData = await res.json();
      setPreview(data);
      toast.success(`Parsed "${data.chatName}" — ${data.totalMessages} messages`);
    } catch {
      toast.error("Failed to parse content");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!pasteContent.trim()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/sync/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import",
          content: pasteContent,
          filename: preview?.chatName,
        }),
      });

      if (!res.ok) throw new Error("Import failed");
      const data: SyncResult = await res.json();
      setSyncResult(data);
      loadHistory();

      if (data.errors.length === 0) {
        toast.success(
          `Synced! ${data.contactsSynced} contacts, ${data.meetingsCreated} meetings`
        );
      } else {
        toast.warning(`Synced with ${data.errors.length} errors`);
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPasteContent("");
    setPreview(null);
    setSyncResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-green-500" />
            WhatsApp Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Import WhatsApp conversations into your CRM as people and meeting notes
          </p>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === "live" ? "default" : "outline"}
          onClick={() => setTab("live")}
          className="gap-2"
        >
          <Wifi className="h-4 w-4" /> Live Sync
        </Button>
        <Button
          variant={tab === "import" ? "default" : "outline"}
          onClick={() => setTab("import")}
          className="gap-2"
        >
          <Upload className="h-4 w-4" /> Import
        </Button>
        <Button
          variant={tab === "history" ? "default" : "outline"}
          onClick={() => { setTab("history"); loadHistory(); }}
          className="gap-2"
        >
          <Clock className="h-4 w-4" /> History
        </Button>
      </div>

      {/* ===== LIVE SYNC TAB ===== */}
      {tab === "live" && <LiveSyncSection />}

      {/* ===== IMPORT TAB ===== */}
      {tab === "import" && (
        <div className="space-y-4">
          {!syncResult && (
            <>
              {/* How to export */}
              <Card className="bg-accent/50">
                <CardContent className="pt-4 pb-4">
                  <h3 className="font-medium text-sm mb-2">📱 How to export a WhatsApp chat</h3>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open the chat in WhatsApp on your phone</li>
                    <li>Tap ⋮ (menu) → More → Export chat</li>
                    <li>Choose &quot;Without media&quot;</li>
                    <li>Send the .txt file to yourself or upload here</li>
                  </ol>
                </CardContent>
              </Card>

              {/* File Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Upload Chat Export
                  </CardTitle>
                  <CardDescription>
                    Upload a .txt file exported from WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />

                  <Separator />

                  <div>
                    <Label className="text-sm font-medium">Or paste export content</Label>
                    <Textarea
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      placeholder="Paste WhatsApp chat export text here..."
                      rows={6}
                      className="mt-1.5 font-mono text-xs"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handlePastePreview}
                      disabled={loading || !pasteContent.trim()}
                      variant="outline"
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Preview
                    </Button>
                    {preview && (
                      <Button onClick={reset} variant="ghost" className="gap-2">
                        <X className="h-4 w-4" /> Clear
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              {preview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="h-5 w-5" /> Preview: {preview.chatName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center p-3 rounded-lg bg-secondary">
                        <p className="text-2xl font-bold">{preview.totalMessages}</p>
                        <p className="text-xs text-muted-foreground">Messages</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-secondary">
                        <p className="text-2xl font-bold">{preview.participants.length}</p>
                        <p className="text-xs text-muted-foreground">Participants</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-secondary">
                        <p className="text-2xl font-bold">{preview.days}</p>
                        <p className="text-xs text-muted-foreground">Days</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-secondary">
                        <p className="text-xs text-muted-foreground mt-1">
                          {preview.dateRange
                            ? `${preview.dateRange.from} → ${preview.dateRange.to}`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">Date Range</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1.5">Participants</p>
                      <div className="flex flex-wrap gap-1.5">
                        {preview.participants.map((p) => (
                          <Badge key={p} variant="secondary">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1.5">
                        Conversation days ({preview.segments.length})
                      </p>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {preview.segments.map((seg) => (
                          <div
                            key={seg.date}
                            className="p-2 rounded border bg-card text-sm"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{seg.date}</span>
                              <Badge variant="outline">{seg.messageCount} msgs</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {seg.preview}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleImport}
                      disabled={loading}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> Import {preview.totalMessages} messages as{" "}
                          {preview.days} meeting notes
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Success */}
          {syncResult && (
            <Card className="border-green-500/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 text-green-500 font-semibold text-lg">
                  <CheckCircle2 className="h-6 w-6" />
                  Import Complete
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-secondary">
                    <p className="text-2xl font-bold">{syncResult.contactsSynced}</p>
                    <p className="text-xs text-muted-foreground">Contacts Synced</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary">
                    <p className="text-2xl font-bold">{syncResult.meetingsCreated}</p>
                    <p className="text-xs text-muted-foreground">Meetings Created</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary">
                    <p className="text-2xl font-bold">{syncResult.messagesSynced}</p>
                    <p className="text-xs text-muted-foreground">Messages Processed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-secondary">
                    <p className="text-2xl font-bold text-red-400">{syncResult.errors.length}</p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </div>
                </div>

                {syncResult.newPeople.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1.5 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> New People Created
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {syncResult.newPeople.map((name) => (
                        <Badge key={name} variant="default">
                          ✨ {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {syncResult.matchedPeople.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1.5">Matched to Existing</p>
                    <div className="flex flex-wrap gap-1.5">
                      {syncResult.matchedPeople.map((match) => (
                        <Badge key={match} variant="secondary">
                          {match}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {syncResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1.5 text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Errors
                    </p>
                    <div className="space-y-1">
                      {syncResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-400">
                          {err}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={reset} className="flex-1 gap-2">
                    <Upload className="h-4 w-4" /> Import Another Chat
                  </Button>
                  <Link href="/people">
                    <Button variant="outline" className="gap-2">
                      <Users className="h-4 w-4" /> View People
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === "history" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Sync History</CardTitle>
              <CardDescription>Recent import and sync operations</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadHistory}
              disabled={historyLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sync history yet. Import a WhatsApp chat to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            entry.status === "completed"
                              ? "default"
                              : entry.status === "error"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {entry.status}
                        </Badge>
                        <span className="text-sm font-medium">{entry.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()} •{" "}
                        {entry.contactsSynced} contacts • {entry.messagesSynced} messages
                        {entry.details && ` • ${entry.details}`}
                      </p>
                    </div>
                    {entry.status === "completed" && (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    {entry.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
