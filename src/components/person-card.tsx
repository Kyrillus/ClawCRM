"use client";

import Link from "next/link";
import { Building2, Briefcase, Calendar } from "lucide-react";
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
  };
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
              {typeof person.meetingCount === "number" && (
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{person.meetingCount} meeting{person.meetingCount !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          </div>
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
