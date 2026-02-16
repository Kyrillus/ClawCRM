"use client";

import { Calendar, Tag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MeetingCardProps {
  meeting: {
    id: number;
    date: string;
    rawInput: string;
    summary: string | null;
    topics: string[] | null;
    personId?: number | null;
  };
  personName?: string;
  compact?: boolean;
}

export function MeetingCard({ meeting, personName, compact }: MeetingCardProps) {
  const date = new Date(meeting.date);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const topics = (meeting.topics || []) as string[];

  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Calendar className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
            {personName && (
              <p className="text-xs font-medium text-primary">{personName}</p>
            )}
          </div>
          <p className="mt-0.5 text-sm line-clamp-2">
            {meeting.summary || meeting.rawInput}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{formattedDate}</span>
          </div>
          {personName && (
            <span className="text-sm font-medium text-primary">{personName}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          {meeting.summary || meeting.rawInput}
        </p>
        {topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topics.map((topic) => (
              <Badge key={topic} variant="secondary" className="text-xs">
                <Tag className="mr-1 h-3 w-3" />
                {topic}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
