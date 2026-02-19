"use client";

import Link from "next/link";
import { Building2, Briefcase, Calendar, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PersonCardProps {
  person: {
    id: number;
    name: string;
    company?: string | null;
    role?: string | null;
    tags?: string[] | null;
    avatarUrl?: string | null;
    meetingCount?: number;
    lastMeetingDate?: string | null;
  };
}

function getLastSeenText(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getLastSeenColor(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (diffDays <= 30) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
];

export function PersonCard({ person }: PersonCardProps) {
  const tags = (person.tags || []) as string[];
  const color = COLORS[person.id % COLORS.length];

  return (
    <Link href={`/people/${person.id}`}>
      <Card className="transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer h-full">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={`${color} text-white font-semibold`}>
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{person.name}</h3>
              {person.role && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{person.role}</span>
                </div>
              )}
              {person.company && (
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{person.company}</span>
                </div>
              )}
            </div>
          </div>
          {(typeof person.meetingCount === "number" && person.meetingCount > 0 || person.lastMeetingDate) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {typeof person.meetingCount === "number" && person.meetingCount > 0 && (
                <Badge variant="outline" className="text-xs gap-1 font-normal">
                  <Calendar className="h-3 w-3" />
                  {person.meetingCount} meeting{person.meetingCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {person.lastMeetingDate && (
                <Badge className={`text-xs gap-1 font-normal border ${getLastSeenColor(person.lastMeetingDate)}`}>
                  <Clock className="h-3 w-3" />
                  {getLastSeenText(person.lastMeetingDate)}
                </Badge>
              )}
            </div>
          )}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{tags.length - 4}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
