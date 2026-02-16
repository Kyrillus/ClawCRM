"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  MessageSquarePlus,
  Users,
  Calendar,
  Network,
  TrendingUp,
  Clock,
  User,
  ArrowRight,
} from "lucide-react";

interface Stats {
  totalContacts: number;
  totalMeetings: number;
  meetingsThisWeek: number;
  totalRelationships: number;
}

interface MeetingPerson {
  personId: number;
  personName: string | null;
  personCompany: string | null;
}

interface MeetingItem {
  meeting: {
    id: number;
    personId: number | null;
    date: string;
    summary: string | null;
    rawInput: string;
    topics: string[];
  };
  people: MeetingPerson[];
  personName: string | null;
  personCompany: string | null;
}

interface SearchResultItem {
  id: number;
  name: string;
  company?: string;
  role?: string;
  score: number;
  snippet: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<MeetingItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/meetings?limit=5").then((r) => r.json()),
    ]).then(([statsData, meetingsData]) => {
      setStats(statsData);
      setRecentMeetings(meetingsData);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        setSearchResults(data.people || []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Hero Search */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Your People, <span className="text-primary">Connected</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Search your network with natural language. Find anyone by what you
          talked about.
        </p>
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder='Try "ML engineers" or "people from Google"...'
            className="pl-12 h-14 text-lg rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="max-w-2xl mx-auto mt-4">
            <Card>
              <CardContent className="p-2">
                {searchResults.map((result) => (
                  <Link
                    key={result.id}
                    href={`/people/${result.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{result.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {result.role && result.company
                          ? `${result.role} at ${result.company}`
                          : result.company || result.snippet}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(result.score * 100)}% match
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
        {searching && (
          <p className="text-sm text-muted-foreground animate-pulse">
            Searching...
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/log">
          <Button size="lg" className="gap-2 rounded-xl">
            <MessageSquarePlus className="w-5 h-5" />
            Log Meeting
          </Button>
        </Link>
        <Link href="/people">
          <Button size="lg" variant="secondary" className="gap-2 rounded-xl">
            <Users className="w-5 h-5" />
            View People
          </Button>
        </Link>
        <Link href="/graph">
          <Button size="lg" variant="secondary" className="gap-2 rounded-xl">
            <Network className="w-5 h-5" />
            Relationship Graph
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          : [
              {
                value: stats?.totalContacts || 0,
                label: "Contacts",
                icon: Users,
              },
              {
                value: stats?.totalMeetings || 0,
                label: "Meetings",
                icon: Calendar,
              },
              {
                value: stats?.meetingsThisWeek || 0,
                label: "This Week",
                icon: TrendingUp,
              },
              {
                value: stats?.totalRelationships || 0,
                label: "Connections",
                icon: Network,
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                    <stat.icon className="w-8 h-8 text-primary/40" />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Recent Meetings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Meetings</h2>
          <Link
            href="/log"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Log new <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentMeetings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquarePlus className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No meetings logged yet.</p>
              <Link href="/log">
                <Button className="mt-4" variant="secondary">
                  Log your first meeting
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentMeetings.map((m) => (
              <Card
                key={m.meeting.id}
                className="hover:bg-secondary/30 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {(m.people && m.people.length > 0 ? m.people : m.personName ? [{ personId: m.meeting.personId, personName: m.personName, personCompany: m.personCompany }] : []).map((p, idx) => (
                          <span key={p.personId || idx} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-muted-foreground">&</span>}
                            <Link
                              href={`/people/${p.personId}`}
                              className="font-medium hover:underline"
                            >
                              {p.personName}
                            </Link>
                            {idx === 0 && p.personCompany && (
                              <span className="text-sm text-muted-foreground">
                                at {p.personCompany}
                              </span>
                            )}
                          </span>
                        ))}
                        {(!m.people || m.people.length === 0) && !m.personName && (
                          <span className="font-medium">Unknown</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {m.meeting.summary || m.meeting.rawInput}
                      </p>
                      {(m.meeting.topics as string[] || []).length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {(m.meeting.topics as string[])
                            .slice(0, 3)
                            .map((topic) => (
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
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {formatDate(m.meeting.date)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
