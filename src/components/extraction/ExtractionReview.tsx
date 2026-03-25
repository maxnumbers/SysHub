import { useState, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { mockExtractionProposal } from "../../mock/data";
import { useLayerColors } from "../../hooks/useLayerColors";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { extractEntities } from "../../api/client";
import type { Node, Edge, ProposedNode, ExtractionProposal } from "../../types";
import { X, Check, Link, AlertTriangle, FileText, Loader2 } from "lucide-react";

export function ExtractionReview() {
  const setOpen = useUIStore((s) => s.setExtractionReviewOpen);
  const addNodes = useGraphStore((s) => s.addNodes);
  const addEdges = useGraphStore((s) => s.addEdges);
  const updateNode = useGraphStore((s) => s.updateNode);
  const layers = useGraphStore((s) => s.layers);
  const nodes = useGraphStore((s) => s.nodes);
  const transcripts = useGraphStore((s) => s.transcripts);
  const layerColors = useLayerColors(layers);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ExtractionProposal>(mockExtractionProposal);
  const [usedLiveAPI, setUsedLiveAPI] = useState(false);

  // Try to extract from the latest transcript via API
  useEffect(() => {
    const latestTranscript = transcripts[transcripts.length - 1];
    if (!latestTranscript) return; // no transcripts, keep mock

    const transcriptText = latestTranscript.segments.map((s) => s.text).join(" ");
    if (!transcriptText.trim()) return;

    setLoading(true);
    setError(null);
    extractEntities({
      transcript_text: transcriptText,
      layer_names: layers.map((l) => l.name),
      existing_entities: nodes.map((n) => n.name),
    })
      .then((result) => {
        // Convert API result to our proposal format
        const converted: ExtractionProposal = {
          nodes: result.entities.map((e, i) => ({
            tempId: `tmp-${Date.now()}-${i}`,
            name: e.name,
            suggestedLayer: layers.find((l) => l.name.toLowerCase().includes(e.suggested_layer.toLowerCase()))?.id
              || layers[0]?.id || "",
            properties: e.properties as Record<string, any>,
            sourceSegmentId: latestTranscript.segments[0]?.id || "",
            confidence: e.confidence,
          })),
          edges: result.relationships.map((r, i) => ({
            tempId: `tmp-e-${Date.now()}-${i}`,
            fromNodeRef: r.from_entity,
            toNodeRef: r.to_entity,
            relationship: r.relationship,
            type: r.type,
            confidence: r.confidence,
            sourceSegmentId: latestTranscript.segments[0]?.id || "",
          })),
          aliasMatches: result.alias_candidates.map((a) => ({
            candidateName: a.new_term,
            existingNodeId: nodes.find((n) => n.name.toLowerCase() === a.existing_entity.toLowerCase())?.id || "",
            existingNodeName: a.existing_entity,
            similarityScore: a.confidence,
            sourceSegmentId: latestTranscript.segments[0]?.id || "",
          })),
          staleNodes: result.stale_doc_flags.map((f) => ({
            nodeId: nodes.find((n) => n.name.toLowerCase() === f.entity_name.toLowerCase())?.id || "",
            nodeName: f.entity_name,
            reason: f.reason,
            affectedSegmentIds: [latestTranscript.segments[0]?.id || ""],
            suggestedReadmeUpdate: f.suggested_update,
          })),
        };
        setProposal(converted);
        setUsedLiveAPI(true);
      })
      .catch((err) => {
        console.warn("API extraction failed, using mock data:", err);
        setError(`API unavailable — showing mock data. (${err.message})`);
      })
      .finally(() => setLoading(false));
  }, []);

  // Track acceptance state
  const [acceptedNodes, setAcceptedNodes] = useState<Set<string>>(new Set());
  const [acceptedEdges, setAcceptedEdges] = useState<Set<string>>(new Set());

  // Update acceptance sets when proposal changes
  useEffect(() => {
    setAcceptedNodes(new Set(proposal.nodes.map((n) => n.tempId)));
    setAcceptedEdges(new Set(proposal.edges.map((e) => e.tempId)));
  }, [proposal]);
  const [aliasResolutions, setAliasResolutions] = useState<Map<string, "same" | "different" | "related">>(
    new Map()
  );
  const [staleActions, setStaleActions] = useState<Map<string, "apply" | "skip">>(new Map());

  const toggleNode = (id: string) => {
    const next = new Set(acceptedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAcceptedNodes(next);
  };

  const toggleEdge = (id: string) => {
    const next = new Set(acceptedEdges);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAcceptedEdges(next);
  };

  const handleApply = () => {
    // Create accepted nodes
    const newNodes: Node[] = proposal.nodes
      .filter((n) => acceptedNodes.has(n.tempId))
      .map((n) => ({
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        graphId: "g-pipeline-ops",
        name: n.name,
        aliases: [],
        layerId: n.suggestedLayer,
        properties: n.properties,
        readme: null,
        childGraphId: null,
        sourceSegmentId: n.sourceSegmentId,
        status: "confirmed" as const,
        createdBy: "u-demo-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

    // Build temp→real ID map
    const idMap = new Map<string, string>();
    proposal.nodes.forEach((pn, i) => {
      if (acceptedNodes.has(pn.tempId) && newNodes[i]) {
        // Find the matching created node
        const created = newNodes.find((nn) => nn.name === pn.name);
        if (created) idMap.set(pn.tempId, created.id);
      }
    });

    // Create accepted edges
    const newEdges: Edge[] = proposal.edges
      .filter((e) => acceptedEdges.has(e.tempId))
      .map((e) => ({
        id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        graphId: "g-pipeline-ops",
        fromNodeId: idMap.get(e.fromNodeRef) || e.fromNodeRef,
        toNodeId: idMap.get(e.toNodeRef) || e.toNodeRef,
        relationship: e.relationship,
        type: e.type,
        weight: null,
        properties: {},
        sourceSegmentId: e.sourceSegmentId,
        status: "confirmed" as const,
        createdBy: "u-demo-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

    if (newNodes.length > 0) addNodes(newNodes);
    if (newEdges.length > 0) addEdges(newEdges);

    // Apply stale node readme updates
    for (const stale of proposal.staleNodes) {
      if (staleActions.get(stale.nodeId) === "apply") {
        updateNode(stale.nodeId, { readme: stale.suggestedReadmeUpdate });
      }
    }

    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="bg-paper rounded-2xl border border-border shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-ink">Review Extracted Entities</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {loading ? "Extracting entities via LLM..." : (
                <>
                  {usedLiveAPI && <span className="text-success mr-1">Live</span>}
                  {proposal.nodes.length} nodes, {proposal.edges.length} edges,{" "}
                  {proposal.aliasMatches.length} alias matches, {proposal.staleNodes.length} stale flags
                </>
              )}
            </p>
            {error && <p className="text-xs text-warning mt-0.5">{error}</p>}
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-paper-darker text-ink-muted">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <Loader2 size={24} className="animate-spin text-accent mx-auto mb-2" />
              <p className="text-sm text-ink-muted">Extracting entities from transcript...</p>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Proposed Nodes */}
          {proposal.nodes.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
                <Check size={14} />
                Proposed Nodes ({proposal.nodes.length})
              </h3>
              <div className="space-y-2">
                {proposal.nodes.map((node) => {
                  const accepted = acceptedNodes.has(node.tempId);
                  const layer = layers.find((l) => l.id === node.suggestedLayer);
                  const color = layerColors.get(node.suggestedLayer) || "#999";
                  return (
                    <div
                      key={node.tempId}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        accepted ? "border-success/30 bg-success/5" : "border-border bg-paper-darker/50 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={() => toggleNode(node.tempId)}
                        className="mt-0.5 rounded text-success"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-ink">{node.name}</span>
                          <span
                            className="text-[10px] px-1.5 py-0 rounded-full"
                            style={{ backgroundColor: color + "20", color }}
                          >
                            {layer?.name}
                          </span>
                          <span className="text-[10px] text-ink-muted ml-auto">
                            {(node.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        {Object.keys(node.properties).length > 0 && (
                          <div className="text-xs text-ink-muted mt-1">
                            {Object.entries(node.properties).map(([k, v]) => (
                              <span key={k} className="mr-2">{k}: {String(v)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Proposed Edges */}
          {proposal.edges.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
                <Link size={14} />
                Proposed Edges ({proposal.edges.length})
              </h3>
              <div className="space-y-2">
                {proposal.edges.map((edge) => {
                  const accepted = acceptedEdges.has(edge.tempId);
                  const fromName = getNodeName(edge.fromNodeRef, nodes, proposal.nodes);
                  const toName = getNodeName(edge.toNodeRef, nodes, proposal.nodes);
                  return (
                    <div
                      key={edge.tempId}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        accepted ? "border-success/30 bg-success/5" : "border-border bg-paper-darker/50 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={() => toggleEdge(edge.tempId)}
                        className="rounded text-success"
                      />
                      <div className="flex-1 text-sm">
                        <span className="font-medium text-ink">{fromName}</span>
                        <span className="text-ink-muted mx-1.5">→</span>
                        <span className="font-medium text-ink">{toName}</span>
                        <span className="text-ink-muted ml-2">"{edge.relationship}"</span>
                      </div>
                      <span className="text-[10px] text-ink-muted">
                        {(edge.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Alias Matches */}
          {proposal.aliasMatches.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-warning" />
                Alias Matches ({proposal.aliasMatches.length})
              </h3>
              <div className="space-y-2">
                {proposal.aliasMatches.map((match) => {
                  const resolution = aliasResolutions.get(match.candidateName);
                  return (
                    <div key={match.candidateName} className="p-3 rounded-lg border border-warning/30 bg-warning/5">
                      <p className="text-sm text-ink mb-2">
                        You said "<strong>{match.candidateName}</strong>". Your graph already has a node called "<strong>{match.existingNodeName}</strong>".
                        <span className="text-ink-muted ml-1">({(match.similarityScore * 100).toFixed(0)}% similar)</span>
                      </p>
                      <div className="flex gap-2">
                        {(["same", "different", "related"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              const next = new Map(aliasResolutions);
                              next.set(match.candidateName, opt);
                              setAliasResolutions(next);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                              resolution === opt
                                ? "border-accent bg-accent text-white"
                                : "border-border hover:border-accent/30"
                            }`}
                          >
                            {opt === "same" ? "Same entity" : opt === "different" ? "Different" : "Related"}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Stale Node Flags */}
          {proposal.staleNodes.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5">
                <FileText size={14} className="text-info" />
                Documentation May Be Stale
              </h3>
              <div className="space-y-2">
                {proposal.staleNodes.map((stale) => {
                  const action = staleActions.get(stale.nodeId);
                  return (
                    <div key={stale.nodeId} className="p-3 rounded-lg border border-info/30 bg-info/5">
                      <p className="text-sm font-medium text-ink mb-1">
                        {stale.nodeName}
                      </p>
                      <p className="text-xs text-ink-muted mb-2">{stale.reason}</p>

                      <details className="mb-2">
                        <summary className="text-xs text-accent cursor-pointer">
                          View suggested README update
                        </summary>
                        <div className="mt-2 p-2 bg-paper rounded border border-border">
                          <MarkdownRenderer content={stale.suggestedReadmeUpdate} />
                        </div>
                      </details>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const next = new Map(staleActions);
                            next.set(stale.nodeId, "apply");
                            setStaleActions(next);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            action === "apply"
                              ? "border-accent bg-accent text-white"
                              : "border-border hover:border-accent/30"
                          }`}
                        >
                          Apply update
                        </button>
                        <button
                          onClick={() => {
                            const next = new Map(staleActions);
                            next.set(stale.nodeId, "skip");
                            setStaleActions(next);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            action === "skip"
                              ? "border-ink-muted bg-paper-darker text-ink-muted"
                              : "border-border hover:border-ink-muted/30"
                          }`}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm rounded-lg border border-border text-ink-muted hover:bg-paper-darker"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Apply ({acceptedNodes.size} nodes, {acceptedEdges.size} edges)
          </button>
        </div>
      </div>
    </div>
  );
}

function getNodeName(ref: string, existingNodes: Node[], proposedNodes: ProposedNode[]): string {
  const existing = existingNodes.find((n) => n.id === ref);
  if (existing) return existing.name;
  const proposed = proposedNodes.find((n) => n.tempId === ref);
  if (proposed) return proposed.name;
  return ref;
}
