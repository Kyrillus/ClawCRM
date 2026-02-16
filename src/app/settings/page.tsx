"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Key,
  Brain,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface SettingsData {
  llm_provider: string;
  llm_model: string;
  llm_api_key: string;
  llm_base_url: string;
  embedding_provider: string;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  google: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
  ],
  ollama: ["llama3", "llama3:70b", "mixtral", "phi3", "gemma2"],
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    llm_provider: "google",
    llm_model: "gemini-2.0-flash",
    llm_api_key: "",
    llm_base_url: "",
    embedding_provider: "local",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          llm_provider: data.llm_provider || "google",
          llm_model: data.llm_model || "gemini-2.0-flash",
          llm_api_key: data.llm_api_key || "",
          llm_base_url: data.llm_base_url || "",
          embedding_provider: data.embedding_provider || "local",
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const res = await fetch("/api/settings/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTestResult("success");
        toast.success("Connection successful!");
      } else {
        setTestResult("error");
        toast.error(data.error || "Connection failed");
      }
    } catch {
      setTestResult("error");
      toast.error("Connection test failed");
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableModels = PROVIDER_MODELS[settings.llm_provider] || [];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your LLM provider and API keys
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            LLM Provider
          </CardTitle>
          <CardDescription>
            Choose the AI provider for meeting processing and profile generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Provider</Label>
            <Select
              value={settings.llm_provider}
              onValueChange={(v) =>
                setSettings({
                  ...settings,
                  llm_provider: v,
                  llm_model: PROVIDER_MODELS[v]?.[0] || "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">
                  Google (Gemini) — Free tier available
                </SelectItem>
                <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="ollama">
                  Ollama (Local) — Self-hosted
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Model</Label>
            <Select
              value={settings.llm_model}
              onValueChange={(v) =>
                setSettings({ ...settings, llm_model: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.llm_provider !== "ollama" && (
            <div>
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
              </Label>
              <Input
                type="password"
                value={settings.llm_api_key}
                onChange={(e) =>
                  setSettings({ ...settings, llm_api_key: e.target.value })
                }
                placeholder={
                  settings.llm_provider === "google"
                    ? "AIza..."
                    : settings.llm_provider === "openai"
                    ? "sk-..."
                    : "sk-ant-..."
                }
              />
              {settings.llm_provider === "google" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Get a free API key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    aistudio.google.com/apikey
                  </a>
                </p>
              )}
            </div>
          )}

          {settings.llm_provider === "ollama" && (
            <div>
              <Label className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                Base URL
              </Label>
              <Input
                value={settings.llm_base_url}
                onChange={(e) =>
                  setSettings({ ...settings, llm_base_url: e.target.value })
                }
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </Button>
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={testing}
              className="gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : testResult === "success" ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : testResult === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : null}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embeddings</CardTitle>
          <CardDescription>
            Configure how semantic search embeddings are generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Embedding Provider</Label>
            <Select
              value={settings.embedding_provider}
              onValueChange={(v) =>
                setSettings({ ...settings, embedding_provider: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">
                  Local (Bag of Words) — No API needed
                </SelectItem>
                <SelectItem value="provider">
                  Use LLM Provider&apos;s Embedding Model
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Local embeddings work without any API key. Provider embeddings
              are more accurate but require an API key.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About ClawCRM</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            ClawCRM is a self-hosted, AI-powered CRM for managing your
            personal and professional relationships.
          </p>
          <p>
            Built with Next.js, shadcn/ui, Drizzle ORM, and SQLite. Your data
            stays on your machine.
          </p>
          <div className="flex gap-2 mt-3">
            <Badge variant="outline">v1.0.0</Badge>
            <Badge variant="outline">Self-hosted</Badge>
            <Badge variant="outline">Open Source</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
