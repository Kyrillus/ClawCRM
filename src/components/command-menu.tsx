"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  MessageSquarePlus,
  GitFork,
  Settings,
  User,
  Calendar,
} from "lucide-react";

interface SearchResult {
  type: "person" | "meeting";
  id: number;
  title: string;
  subtitle: string;
  score: number;
  personId?: number;
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : (data.results || []));
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/people")}>
            <Users className="mr-2 h-4 w-4" />
            People
          </CommandItem>
          <CommandItem onSelect={() => go("/log")}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Log Meeting
          </CommandItem>
          <CommandItem onSelect={() => go("/graph")}>
            <GitFork className="mr-2 h-4 w-4" />
            Relationship Graph
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        {results.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Search Results">
              {results.map((r) => (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  onSelect={() => {
                    if (r.type === "person") {
                      go(`/people/${r.id}`);
                    } else if (r.personId) {
                      go(`/people/${r.personId}`);
                    }
                  }}
                >
                  {r.type === "person" ? (
                    <User className="mr-2 h-4 w-4" />
                  ) : (
                    <Calendar className="mr-2 h-4 w-4" />
                  )}
                  <div>
                    <span>{r.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.subtitle}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
