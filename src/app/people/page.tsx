"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  User,
  Clock,
  LayoutGrid,
  List,
  MessageSquare,
  Users,
} from "lucide-react";

interface PersonListItem {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  tags: string[];
  avatarUrl: string | null;
  lastMeetingDate: string | null;
  meetingCount: number;
}

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    tags: "",
  });

  const loadPeople = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedTag) params.set("tag", selectedTag);
    const res = await fetch(`/api/people?${params}`);
    const data = await res.json();
    setPeople(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPeople();
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => setAllTags(data.allTags || []));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(loadPeople, 300);
    return () => clearTimeout(timeout);
  }, [search, selectedTag]);

  const handleAddPerson = async () => {
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newPerson,
        tags: newPerson.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      setShowAddDialog(false);
      setNewPerson({
        name: "",
        email: "",
        phone: "",
        company: "",
        role: "",
        tags: "",
      });
      loadPeople();
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">People</h1>
          <p className="text-muted-foreground">
            {people.length} contact{people.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Person
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Person</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={newPerson.name}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, name: e.target.value })
                  }
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    value={newPerson.email}
                    onChange={(e) =>
                      setNewPerson({ ...newPerson, email: e.target.value })
                    }
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={newPerson.phone}
                    onChange={(e) =>
                      setNewPerson({ ...newPerson, phone: e.target.value })
                    }
                    placeholder="+1-555-..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company</Label>
                  <Input
                    value={newPerson.company}
                    onChange={(e) =>
                      setNewPerson({ ...newPerson, company: e.target.value })
                    }
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={newPerson.role}
                    onChange={(e) =>
                      setNewPerson({ ...newPerson, role: e.target.value })
                    }
                    placeholder="Job title"
                  />
                </div>
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={newPerson.tags}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, tags: e.target.value })
                  }
                  placeholder="engineering, AI, startup"
                />
              </div>
              <Button
                onClick={handleAddPerson}
                disabled={!newPerson.name}
                className="w-full"
              >
                Add Person
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, or role..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={selectedTag === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedTag(null)}
          >
            All
          </Badge>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                setSelectedTag(selectedTag === tag ? null : tag)
              }
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* People Grid/List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : people.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No contacts yet</p>
            <p className="text-muted-foreground mt-1">
              Add people manually or log a meeting to get started.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => (
            <Link key={person.id} href={`/people/${person.id}`}>
              <Card className="hover:bg-secondary/30 transition-all hover:shadow-md cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{person.name}</h3>
                      {(person.role || person.company) && (
                        <p className="text-sm text-muted-foreground truncate">
                          {person.role}
                          {person.role && person.company ? " at " : ""}
                          {person.company}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {person.meetingCount} meeting
                      {person.meetingCount !== 1 ? "s" : ""}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(person.lastMeetingDate)}
                    </div>
                  </div>
                  {(person.tags || []).length > 0 && (
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {person.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {person.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{person.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {people.map((person) => (
            <Link key={person.id} href={`/people/${person.id}`}>
              <Card className="hover:bg-secondary/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{person.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {person.role}
                      {person.role && person.company ? " at " : ""}
                      {person.company}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{person.meetingCount} meetings</span>
                    <span>{formatDate(person.lastMeetingDate)}</span>
                  </div>
                  <div className="flex gap-1">
                    {(person.tags || []).slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
