"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Maximize2, Minimize2, RotateCcw, Info } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-card rounded-xl border">
      <Skeleton className="w-full h-full rounded-xl" />
    </div>
  ),
});

interface GraphNode {
  id: number;
  name: string;
  company: string;
  role: string;
  tags: string[];
  meetingCount: number;
  val: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  context: string;
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const TAG_COLORS: Record<string, string> = {
  engineering: "#3b82f6",
  AI: "#8b5cf6",
  ML: "#8b5cf6",
  design: "#ec4899",
  creative: "#ec4899",
  investor: "#10b981",
  VC: "#10b981",
  startup: "#f59e0b",
  founder: "#f59e0b",
  research: "#06b6d4",
  academia: "#06b6d4",
  cloud: "#6366f1",
  infrastructure: "#6366f1",
  leadership: "#ef4444",
  product: "#f97316",
};

function getNodeColor(tags: string[]): string {
  if (!tags) return "#6b7280";
  for (const tag of tags) {
    if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  }
  return "#6b7280";
}

export default function GraphPage() {
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    router.push(`/people/${node.id}`);
  }, [router]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node || null);
  }, []);

  const handleZoomToFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  const handleReheat = () => {
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation();
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Relationship Graph</h1>
        <Skeleton className="w-full h-[600px] rounded-xl" />
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Relationship Graph</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No data yet</p>
            <p className="text-muted-foreground mt-1">
              Add people and log meetings to see your relationship graph.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`space-y-4 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-background p-4"
          : "p-4 md:p-8 max-w-6xl mx-auto"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relationship Graph</h1>
          <p className="text-muted-foreground">
            {graphData.nodes.length} people • {graphData.links.length} connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReheat}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomToFit}>
            Fit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl border bg-card overflow-hidden"
        style={{ height: isFullscreen ? "calc(100vh - 120px)" : "600px" }}
      >
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel={(node: object) => {
            const n = node as GraphNode;
            return `${n.name}${n.company ? ` (${n.company})` : ""}`;
          }}
          nodeColor={(node: object) => getNodeColor((node as GraphNode).tags)}
          nodeVal={(node: object) => Math.max(3, ((node as GraphNode).meetingCount || 0) * 3 + 2)}
          nodeCanvasObject={(node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const n = node as GraphNode;
            const size = Math.max(4, (n.meetingCount || 0) * 2 + 4);
            const fontSize = Math.max(10, 12 / globalScale);
            const color = getNodeColor(n.tags || []);

            ctx.beginPath();
            ctx.arc(n.x!, n.y!, size, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.strokeStyle = "rgba(255,255,255,0.3)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (globalScale > 0.5) {
              ctx.font = `${fontSize}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "rgba(255,255,255,0.9)";
              ctx.fillText(n.name, n.x!, n.y! + size + fontSize);
            }
          }}
          linkColor={() => "rgba(255,255,255,0.15)"}
          linkWidth={(link: object) => Math.max(1, ((link as GraphLink).strength || 1) * 0.5)}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() => "rgba(255,255,255,0.3)"}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor="transparent"
          width={containerRef.current?.clientWidth || 800}
          height={isFullscreen ? (typeof window !== "undefined" ? window.innerHeight - 120 : 600) : 600}
          cooldownTime={3000}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />

        {hoveredNode && (
          <div className="absolute top-4 left-4 bg-popover border rounded-lg p-3 shadow-lg max-w-xs">
            <p className="font-semibold">{hoveredNode.name}</p>
            {hoveredNode.role && (
              <p className="text-sm text-muted-foreground">
                {hoveredNode.role}
                {hoveredNode.company ? ` at ${hoveredNode.company}` : ""}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {hoveredNode.meetingCount} meeting{hoveredNode.meetingCount !== 1 ? "s" : ""}
            </p>
            {hoveredNode.tags && hoveredNode.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {hoveredNode.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Click to view profile</p>
          </div>
        )}

        <div className="absolute bottom-4 right-4 bg-popover/80 backdrop-blur-sm border rounded-lg p-3">
          <p className="text-xs font-medium mb-2">Legend</p>
          <div className="space-y-1">
            {[
              ["Engineering", "#3b82f6"],
              ["AI/ML", "#8b5cf6"],
              ["Design", "#ec4899"],
              ["Investor", "#10b981"],
              ["Startup", "#f59e0b"],
              ["Research", "#06b6d4"],
            ].map(([label, color]) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
