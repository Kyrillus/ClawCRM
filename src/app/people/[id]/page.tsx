"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Globe,
  Edit,
  Save,
  Clock,
  MessageSquare,
  Users,
  Trash2,
  RefreshCw,
  X,
  Activity,
  CalendarDays,
  TrendingUp,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

interface PersonDetail {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  tags: string[];
  socials: Record<string, string> | null;
  context: string | null;
  personMd: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  meetings: {
    id: number;
    date: string;
    rawInput: string;
    summary: string | null;
    topics: string[];
  }[];
  relationships: {
    id: number;
    context: string | null;
    strength: number | null;
    relatedPerson: {
      id: number;
      name: string;
      company: string | null;
      role: string | null;
    } | null;
  }[];
}

export default function PersonProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadPerson();
  }, [id]);

  const loadPerson = async () => {
    setLoading(true);
    const res = await fetch(`/api/people/${id}`);
    if (!res.ok) {
      router.push("/people");
      return;
    }
    const data = await res.json();
    setPerson(data);
    setEditForm({
      name: data.name,
      email: data.email || "",
      phone: data.phone || "",
      company: data.company || "",
      role: data.role || "",
      tags: (data.tags || []).join(", "),
    });
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/people/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        tags: editForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      toast.success("Person updated");
      setEditing(false);
      loadPerson();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this person?")) return;
    const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Person deleted");
      router.push("/people");
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/people/${id}/regenerate`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Profile regenerated");
        loadPerson();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to regenerate");
      }
    } catch {
      toast.error("Failed to regenerate profile");
    }
    setRegenerating(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!person) return null;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{person.name}</h1>
              {(person.role || person.company) && (
                <p className="text-muted-foreground">
                  {person.role}
                  {person.role && person.company ? " at " : ""}
                  {person.company}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? (
              <>
                <X className="w-4 h-4 mr-1" /> Cancel
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-1" /> Edit
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 ${regenerating ? "animate-spin" : ""}`}
            />
            Regenerate
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tags & Relationship Strength */}
      <div className="flex items-center gap-3 flex-wrap">
        {(person.tags || []).length > 0 &&
          person.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        {(() => {
          const meetings = person.meetings || [];
          const count = meetings.length;
          if (count === 0) return null;
          const lastDate = meetings.reduce((latest, m) =>
            m.date > latest ? m.date : latest, meetings[0].date);
          const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          let label: string, color: string;
          if (count >= 5 && daysSince <= 14) { label = "Strong"; color = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"; }
          else if (count >= 3 && daysSince <= 30) { label = "Good"; color = "bg-blue-500/15 text-blue-400 border-blue-500/30"; }
          else if (daysSince > 60) { label = "Fading"; color = "bg-red-500/15 text-red-400 border-red-500/30"; }
          else if (count <= 1) { label = "New"; color = "bg-violet-500/15 text-violet-400 border-violet-500/30"; }
          else { label = "Moderate"; color = "bg-amber-500/15 text-amber-400 border-amber-500/30"; }
          return (
            <Badge className={`gap-1 border ${color}`}>
              <Activity className="h-3 w-3" />
              {label}
            </Badge>
          );
        })()}
      </div>

      {/* Edit Form */}
      {editing && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  value={editForm.company}
                  onChange={(e) =>
                    setEditForm({ ...editForm, company: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Role</Label>
                <Input
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={editForm.tags}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tags: e.target.value })
                  }
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {person.meetings.length > 0 && (() => {
        const meetings = person.meetings;
        const count = meetings.length;
        const dates = meetings.map(m => new Date(m.date)).sort((a, b) => a.getTime() - b.getTime());
        const firstMet = dates[0];
        const monthsSpan = Math.max(1, (Date.now() - firstMet.getTime()) / (1000 * 60 * 60 * 24 * 30));
        const avgPerMonth = (count / monthsSpan).toFixed(1);
        const topicCounts: Record<string, number> = {};
        meetings.forEach(m => (m.topics || []).forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; }));
        const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Total Meetings
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{firstMet.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" /> First Met
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{avgPerMonth}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Per Month
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{Object.keys(topicCounts).length}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Hash className="h-3 w-3" /> Topics
                  </div>
                </div>
              </div>
              {topTopics.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Most discussed</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topTopics.map(([topic, cnt]) => (
                      <Badge key={topic} variant="outline" className="text-xs">
                        {topic} ({cnt})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="meetings">
            Meetings ({person.meetings.length})
          </TabsTrigger>
          <TabsTrigger value="connections">
            Connections ({person.relationships.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {person.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`mailto:${person.email}`}
                      className="hover:underline"
                    >
                      {person.email}
                    </a>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`tel:${person.phone}`}
                      className="hover:underline"
                    >
                      {person.phone}
                    </a>
                  </div>
                )}
                {person.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {person.company}
                  </div>
                )}
                {person.role && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    {person.role}
                  </div>
                )}
                {person.socials &&
                  Object.entries(person.socials).map(([platform, url]) => (
                    <div
                      key={platform}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={
                          url.startsWith("http") ? url : `https://${url}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {platform}
                      </a>
                    </div>
                  ))}
              </div>
              <Separator className="my-4" />
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {person.personMd ? (
                  <ReactMarkdown>{person.personMd}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic">
                    No profile generated yet. Log a meeting to auto-generate, or
                    click &quot;Regenerate&quot;.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="mt-4 space-y-3">
          {person.meetings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No meetings with {person.name} yet.
                </p>
                <Link href="/log">
                  <Button variant="secondary" className="mt-4">
                    Log a Meeting
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            person.meetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="w-4 h-4" />
                    {formatDate(meeting.date)}
                  </div>
                  {meeting.summary && (
                    <p className="font-medium mb-2">{meeting.summary}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {meeting.rawInput}
                  </p>
                  {(meeting.topics || []).length > 0 && (
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {meeting.topics.map((topic) => (
                        <Badge
                          key={topic}
                          variant="outline"
                          className="text-xs"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-4 space-y-3">
          {person.relationships.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No connections found yet. Connections are automatically
                  discovered from meeting co-mentions.
                </p>
              </CardContent>
            </Card>
          ) : (
            person.relationships.map((rel) =>
              rel.relatedPerson ? (
                <Link key={rel.id} href={`/people/${rel.relatedPerson.id}`}>
                  <Card className="hover:bg-secondary/30 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {rel.relatedPerson.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {rel.relatedPerson.role}
                          {rel.relatedPerson.role &&
                          rel.relatedPerson.company
                            ? " at "
                            : ""}
                          {rel.relatedPerson.company}
                        </p>
                        {rel.context && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rel.context}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        Strength: {rel.strength}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ) : null
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
