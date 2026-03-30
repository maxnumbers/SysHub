import { useState } from "react";
import { X, ArrowLeft, Plus, GripVertical, Trash2, Loader2, Mic, MicOff, Check, FileText } from "lucide-react";
import { useLibraryStore } from "../../store/libraryStore";
import { useGraphStore } from "../../store/graphStore";
import { suggestWarmStart, seedExtract, submitExtractionFeedback } from "../../api/client";
import { transcribeAudio } from "../../api/client";
import { useUIStore } from "../../store/uiStore";
import { getLayerColor } from "../shared/ColorUtils";
import { LLMStreamView } from "../shared/LLMStreamView";
import { useHistoryStore } from "../../store/historyStore";
import type { Graph, Layer, Node, Edge } from "../../types";
import type { SeedQuestion, ExtractedEntity, ExtractedRelationship, ExtractionResult } from "../../api/client";

interface Props {
  onComplete: (graphId: string) => void;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const FRAME_OPTIONS = [
  { value: "organization", label: "An organization or team", desc: "Map the people, processes, and systems" },
  { value: "problem", label: "A problem or challenge", desc: "Trace causes, effects, and constraints" },
  { value: "decision", label: "A decision with trade-offs", desc: "Surface the options and their consequences" },
  { value: "process", label: "A process or workflow", desc: "Document how things actually work" },
] as const;

const INTENT_OPTIONS = [
  { value: "not_working", label: "Something isn't working", desc: "I need to find what's broken" },
  { value: "explain", label: "I need to explain this", desc: "Someone else needs to understand" },
  { value: "intervene", label: "I'm looking for leverage", desc: "I want to find where to intervene" },
  { value: "understand", label: "I want to understand", desc: "I'm trying to see the whole picture" },
] as const;

const SCOPE_OPTIONS = [
  { value: "solo", label: "Just me", desc: "I'm thinking through this alone" },
  { value: "team", label: "My team", desc: "We need shared understanding" },
  { value: "stakeholders", label: "Stakeholders who disagree", desc: "We need to surface the disagreement" },
  { value: "absent", label: "People who aren't here", desc: "Their perspective is missing" },
] as const;

const LAYER_SUGGESTIONS: Record<string, string[]> = {
  "organization|not_working": ["People & Roles", "Processes & Workflows", "Tools & Systems", "Constraints & Policies"],
  "organization|explain": ["People & Roles", "Processes & Workflows", "Tools & Systems", "Outputs & Outcomes"],
  "organization|intervene": ["People & Roles", "Processes & Workflows", "Pain Points", "Leverage Points"],
  "organization|understand": ["People & Roles", "Processes & Workflows", "Tools & Systems", "Dependencies"],
  "problem|not_working": ["Symptoms & Effects", "Root Causes", "Stakeholders", "Constraints"],
  "problem|explain": ["Context", "Root Causes", "Effects", "Dependencies"],
  "problem|intervene": ["Root Causes", "Symptoms", "Proposed Interventions", "Constraints"],
  "problem|understand": ["Stakeholder Perspectives", "Root Causes", "Symptoms & Effects", "Context"],
  "decision|not_working": ["Options", "Trade-offs", "Stakeholders", "Constraints"],
  "decision|explain": ["Options", "Criteria", "Trade-offs", "Recommendation"],
  "decision|intervene": ["Options", "Stakeholder Positions", "Trade-offs", "Risks"],
  "decision|understand": ["Options", "Trade-offs", "Constraints", "Dependencies"],
  "process|not_working": ["Steps & Stages", "Handoffs", "Bottlenecks", "Dependencies"],
  "process|explain": ["Steps & Stages", "Roles", "Inputs & Outputs", "Dependencies"],
  "process|intervene": ["Steps & Stages", "Bottlenecks", "Automation Opportunities", "Constraints"],
  "process|understand": ["Steps & Stages", "Roles", "Tools", "Dependencies"],
};

export function WarmStartModal({ onComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [frame, setFrame] = useState<string>("");
  const [intent, setIntent] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [title, setTitle] = useState("");
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [seedQuestions, setSeedQuestions] = useState<SeedQuestion[]>([]);
  const [seedAnswers, setSeedAnswers] = useState<Record<string, string>>({});
  const [createdGraphId, setCreatedGraphId] = useState<string | null>(null);
  const [createdLayers, setCreatedLayers] = useState<Layer[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [acceptedEntities, setAcceptedEntities] = useState<Set<number>>(new Set());
  const [acceptedRelationships, setAcceptedRelationships] = useState<Set<number>>(new Set());
  const [entityEdits, setEntityEdits] = useState<Record<number, { name?: string; layer?: string }>>({});
  const [recording, setRecording] = useState<string | null>(null); // layer name being recorded
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const addGraph = useLibraryStore((s) => s.addGraph);
  const loadEmpty = useGraphStore((s) => s.loadEmpty);
  const addNodes = useGraphStore((s) => s.addNodes);
  const addEdges = useGraphStore((s) => s.addEdges);
  const saveCurrentGraph = useGraphStore((s) => s.saveCurrentGraph);
  const speechProvider = useUIStore((s) => s.speechProvider);

  const [suggestingLayers, setSuggestingLayers] = useState(false);

  const handleFrameSelect = (value: string) => {
    setFrame(value);
    setStep(2);
  };

  const handleIntentSelect = (value: string) => {
    setIntent(value);
    setStep(3);
  };

  const handleScopeSelect = async (value: string) => {
    setScope(value);
    setStep(4);

    setSuggestingLayers(true);
    try {
      const result = await suggestWarmStart({ frame, intent, scope: value });
      setLayerNames(result.layers.map((l) => l.name));
      setSeedQuestions(result.seed_questions || []);
    } catch {
      const key = `${frame}|${intent}`;
      const suggested = LAYER_SUGGESTIONS[key] || ["Layer 1", "Layer 2", "Layer 3"];
      setLayerNames(suggested);
      // Generate basic seed questions as fallback
      setSeedQuestions(suggested.map((name) => ({
        layer_name: name,
        questions: [`What are the key elements of ${name.toLowerCase()}?`, `How does ${name.toLowerCase()} relate to the other layers?`],
      })));
    } finally {
      setSuggestingLayers(false);
    }
  };

  const handleAddLayer = () => {
    setLayerNames([...layerNames, ""]);
  };

  const handleRemoveLayer = (idx: number) => {
    setLayerNames(layerNames.filter((_, i) => i !== idx));
  };

  const handleLayerRename = (idx: number, name: string) => {
    const next = [...layerNames];
    next[idx] = name;
    setLayerNames(next);
  };

  const handleCreate = () => {
    if (!title.trim() || layerNames.filter(Boolean).length === 0) return;

    const graphId = `g-${Date.now()}`;
    const layers: Layer[] = layerNames
      .filter(Boolean)
      .map((name, i) => ({
        id: `l-${Date.now()}-${i}`,
        graphId,
        name,
        order: i,
        colorOverride: null,
      }));

    const graph: Graph = {
      id: graphId,
      title: title.trim(),
      readme: `# ${title.trim()}\n\nCreated via guided setup.`,
      visibility: "private",
      frame: frame as any,
      intent: intent as any,
      layers,
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        isolatedNodeCount: 0,
        lastModified: new Date().toISOString(),
        contributors: ["u-demo-user"],
        openProposals: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addGraph(graph);
    loadEmpty(graphId, layers);
    setCreatedGraphId(graphId);
    setCreatedLayers(layers);
    // Clear seed answers when re-entering step 5 (layers may have changed)
    setSeedAnswers({});
    setStep(5);
  };

  // Step 5: Dictation per layer
  const handleStartRecording = async (layerName: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        try {
          const result = await transcribeAudio(blob, speechProvider);
          const text = result.segments.map((s) => s.text).join(" ");
          setSeedAnswers((prev) => ({
            ...prev,
            [layerName]: (prev[layerName] || "") + (prev[layerName] ? "\n" : "") + text,
          }));
        } catch (err) {
          console.error("Transcription failed:", err);
        }
        setRecording(null);
        setMediaRecorder(null);
      };
      recorder.start();
      setRecording(layerName);
      setMediaRecorder(recorder);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
  };

  // Step 5 -> Step 6: Extract entities
  const handleExtract = async () => {
    const filledLayers = Object.entries(seedAnswers).filter(([, v]) => v.trim());
    if (filledLayers.length === 0) return;

    setExtracting(true);
    try {
      const combinedText = filledLayers
        .map(([layer, text]) => `[Layer: ${layer}]\n${text}`)
        .join("\n\n");

      const result = await seedExtract({
        transcript_text: combinedText,
        layer_names: layerNames.filter(Boolean),
        existing_entities: [],
      });

      setExtractionResult(result);
      // Pre-accept all entities and relationships
      setAcceptedEntities(new Set(result.entities.map((_, i) => i)));
      setAcceptedRelationships(new Set(result.relationships.map((_, i) => i)));
      setStep(6);
    } catch (err) {
      console.error("Seed extraction failed:", err);
      // On failure, skip to workspace
      if (createdGraphId) onComplete(createdGraphId);
    } finally {
      setExtracting(false);
    }
  };

  // Step 6: Apply accepted entities
  const handleApplyAndOpen = () => {
    if (!extractionResult || !createdGraphId) return;

    const layerMap = new Map(createdLayers.map((l) => [l.name.toLowerCase(), l.id]));

    // Build nodes from accepted entities
    const newNodes: Node[] = [];
    const entityNameToId = new Map<string, string>();

    extractionResult.entities.forEach((entity, idx) => {
      if (!acceptedEntities.has(idx)) return;
      const edits = entityEdits[idx];
      const name = edits?.name || entity.name;
      const layerName = edits?.layer || entity.suggested_layer;
      const layerId = layerMap.get(layerName.toLowerCase()) || createdLayers[0]?.id;
      if (!layerId) return;

      const nodeId = `n-${Date.now()}-${idx}`;
      entityNameToId.set(entity.name.toLowerCase(), nodeId);
      if (edits?.name) entityNameToId.set(edits.name.toLowerCase(), nodeId);

      newNodes.push({
        id: nodeId,
        graphId: createdGraphId,
        name,
        aliases: [],
        layerId,
        properties: entity.properties || {},
        readme: null,
        childGraphId: null,
        sourceSegmentId: null,
        status: "confirmed",
        createdBy: "u-demo-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Build edges from accepted relationships
    const newEdges: Edge[] = [];
    extractionResult.relationships.forEach((rel, idx) => {
      if (!acceptedRelationships.has(idx)) return;
      const fromId = entityNameToId.get(rel.from_entity.toLowerCase());
      const toId = entityNameToId.get(rel.to_entity.toLowerCase());
      if (!fromId || !toId) return;

      newEdges.push({
        id: `e-${Date.now()}-${idx}`,
        graphId: createdGraphId,
        fromNodeId: fromId,
        toNodeId: toId,
        relationship: rel.relationship,
        type: rel.type || "structural",
        weight: null,
        properties: {},
        sourceSegmentId: null,
        status: "confirmed",
        createdBy: "u-demo-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    useHistoryStore.getState().commit(
      `Warm start: ${newNodes.length} nodes, ${newEdges.length} edges`,
      () => {
        if (newNodes.length > 0) addNodes(newNodes);
        if (newEdges.length > 0) addEdges(newEdges);
      }
    );

    // Submit feedback
    const accepted = extractionResult.entities
      .filter((_, i) => acceptedEntities.has(i))
      .map((e, i) => ({ name: entityEdits[i]?.name || e.name, layer: entityEdits[i]?.layer || e.suggested_layer }));
    const rejected = extractionResult.entities
      .filter((_, i) => !acceptedEntities.has(i))
      .map((e) => ({ name: e.name, layer: e.suggested_layer }));
    const edited = Object.entries(entityEdits)
      .filter(([i]) => acceptedEntities.has(parseInt(i)))
      .map(([i, edits]) => {
        const orig = extractionResult.entities[parseInt(i)];
        return {
          original_name: orig.name,
          final_name: edits.name || orig.name,
          original_layer: orig.suggested_layer,
          final_layer: edits.layer || orig.suggested_layer,
        };
      })
      .filter((e) => e.original_name !== e.final_name || e.original_layer !== e.final_layer);

    submitExtractionFeedback({ accepted, rejected, edited }).catch(() => {});

    // Save current graph state so the snapshot includes the new nodes/edges
    // before navigation triggers loadGraph which reads from the snapshot
    saveCurrentGraph();

    onComplete(createdGraphId);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const canGoBack = step > 1 && step <= 5;

  const totalSteps = seedQuestions.length > 0 ? 6 : 4;
  const progressStep = Math.min(step, totalSteps);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="bg-paper rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1 rounded hover:bg-paper-darker text-ink-muted"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="text-xs text-ink-muted font-medium">Step {progressStep} of {totalSteps}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-paper-darker text-ink-muted">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 mb-4 h-1 bg-paper-darker rounded-full overflow-hidden shrink-0">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${(progressStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step content -- scrollable */}
        <div className="px-5 pb-5 overflow-y-auto flex-1">
          {step === 1 && (
            <SelectionStep
              question="What are you trying to understand?"
              options={FRAME_OPTIONS}
              onSelect={handleFrameSelect}
              selected={frame}
            />
          )}
          {step === 2 && (
            <SelectionStep
              question="What's driving you to map this?"
              options={INTENT_OPTIONS}
              onSelect={handleIntentSelect}
              selected={intent}
            />
          )}
          {step === 3 && (
            <SelectionStep
              question="Who else is part of this?"
              options={SCOPE_OPTIONS}
              onSelect={handleScopeSelect}
              selected={scope}
            />
          )}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-medium text-ink mb-4">
                Name your graph and set up layers
              </h2>

              <input
                type="text"
                placeholder="Give this graph a name..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-paper-dark border border-border rounded-lg mb-4 focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />

              {suggestingLayers ? (
                <div className="flex items-center gap-2 text-sm text-ink-muted mb-3">
                  <Loader2 size={14} className="animate-spin" />
                  Generating layer suggestions...
                </div>
              ) : (
                <p className="text-sm text-ink-muted mb-3">
                  Rename, reorder, add, or remove until it feels right.
                </p>
              )}

              <div className="space-y-1.5 mb-3">
                {layerNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <GripVertical size={14} className="text-ink-muted shrink-0 cursor-grab" />
                    <span className="text-xs text-ink-muted w-4 shrink-0">{idx + 1}</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleLayerRename(idx, e.target.value)}
                      className="flex-1 px-2 py-1.5 text-sm bg-paper-dark border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      onClick={() => handleRemoveLayer(idx)}
                      className="p-1 rounded hover:bg-paper-darker text-ink-muted hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddLayer}
                className="flex items-center gap-1 text-sm text-accent hover:text-accent-light mb-4"
              >
                <Plus size={14} /> Add layer
              </button>

              <button
                onClick={handleCreate}
                disabled={!title.trim() || layerNames.filter(Boolean).length === 0}
                className="w-full py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 5: Describe your system */}
          {step === 5 && (
            <div>
              <h2 className="text-lg font-medium text-ink mb-1">
                Describe your system
              </h2>
              <p className="text-sm text-ink-muted mb-4">
                Answer the questions below and/or paste existing documentation for each layer.
                Both are optional -- use whichever works best for you.
              </p>

              <div className="space-y-4 mb-5">
                {layerNames.filter(Boolean).map((layerName, idx) => {
                  const questions = seedQuestions.find(
                    (sq) => sq.layer_name.toLowerCase() === layerName.toLowerCase()
                  )?.questions || [];
                  const color = getLayerColor(idx, layerNames.filter(Boolean).length, null);
                  const isRecording = recording === layerName;

                  return (
                    <div key={idx} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-paper-darker">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm font-medium text-ink flex-1">{layerName}</span>
                        <button
                          onClick={() => isRecording ? handleStopRecording() : handleStartRecording(layerName)}
                          className={`p-1.5 rounded-full transition-colors ${
                            isRecording
                              ? "bg-danger text-white animate-pulse"
                              : "hover:bg-paper text-ink-muted"
                          }`}
                          title={isRecording ? "Stop recording" : "Record audio"}
                        >
                          {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                      </div>

                      {questions.length > 0 && (
                        <div className="px-3 py-2 border-b border-border bg-paper">
                          <p className="text-xs text-ink-muted mb-1">Guiding questions:</p>
                          <ul className="text-xs text-ink-muted space-y-0.5">
                            {questions.map((q, qi) => (
                              <li key={qi} className="flex gap-1">
                                <span className="text-accent shrink-0">--</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <textarea
                        placeholder="Type, paste docs, or use the mic..."
                        value={seedAnswers[layerName] || ""}
                        onChange={(e) => setSeedAnswers((prev) => ({ ...prev, [layerName]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-paper border-0 focus:outline-none focus:ring-0 resize-none min-h-[80px]"
                        rows={3}
                      />
                    </div>
                  );
                })}
              </div>

              {/* LLM processing view */}
              {extracting && (
                <LLMStreamView
                  active={extracting}
                  statusText="Extracting entities and relationships..."
                  className="mb-3"
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => createdGraphId && onComplete(createdGraphId)}
                  disabled={extracting}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border border-border text-ink-muted hover:bg-paper-darker disabled:opacity-40 transition-colors"
                >
                  Skip -- Open Empty Graph
                </button>
                <button
                  onClick={handleExtract}
                  disabled={extracting || Object.values(seedAnswers).every((v) => !v.trim())}
                  className="flex-1 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      Extract & Review
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Review extracted entities */}
          {step === 6 && extractionResult && (
            <div>
              <h2 className="text-lg font-medium text-ink mb-1">
                Review extracted entities
              </h2>
              <p className="text-sm text-ink-muted mb-4">
                All items are pre-accepted. Uncheck to reject, or click a name to edit it.
              </p>

              {/* Entities */}
              {extractionResult.entities.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                    Entities ({acceptedEntities.size}/{extractionResult.entities.length})
                  </h3>
                  <div className="space-y-1">
                    {extractionResult.entities.map((entity, idx) => {
                      const accepted = acceptedEntities.has(idx);
                      const edits = entityEdits[idx];
                      const displayName = edits?.name || entity.name;
                      const displayLayer = edits?.layer || entity.suggested_layer;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded border text-sm transition-colors ${
                            accepted ? "border-border bg-paper" : "border-border/50 bg-paper-darker opacity-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={accepted}
                            onChange={() => {
                              const next = new Set(acceptedEntities);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              setAcceptedEntities(next);
                            }}
                            className="rounded text-accent shrink-0"
                          />
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setEntityEdits((prev) => ({
                              ...prev,
                              [idx]: { ...prev[idx], name: e.target.value },
                            }))}
                            className="flex-1 bg-transparent text-sm font-medium text-ink border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-1"
                          />
                          <select
                            value={displayLayer}
                            onChange={(e) => setEntityEdits((prev) => ({
                              ...prev,
                              [idx]: { ...prev[idx], layer: e.target.value },
                            }))}
                            className="text-xs bg-paper-dark border border-border rounded px-1 py-0.5"
                          >
                            {layerNames.filter(Boolean).map((ln) => (
                              <option key={ln} value={ln}>{ln}</option>
                            ))}
                          </select>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            entity.confidence >= 0.9
                              ? "bg-success/10 text-success"
                              : entity.confidence >= 0.7
                                ? "bg-warning/10 text-warning"
                                : "bg-danger/10 text-danger"
                          }`}>
                            {Math.round(entity.confidence * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Relationships */}
              {extractionResult.relationships.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                    Relationships ({acceptedRelationships.size}/{extractionResult.relationships.length})
                  </h3>
                  <div className="space-y-1">
                    {extractionResult.relationships.map((rel, idx) => {
                      const accepted = acceptedRelationships.has(idx);
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded border text-sm transition-colors ${
                            accepted ? "border-border bg-paper" : "border-border/50 bg-paper-darker opacity-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={accepted}
                            onChange={() => {
                              const next = new Set(acceptedRelationships);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              setAcceptedRelationships(next);
                            }}
                            className="rounded text-accent shrink-0"
                          />
                          <span className="font-medium">{rel.from_entity}</span>
                          <span className="text-ink-muted">--</span>
                          <span className="text-xs text-accent italic">{rel.relationship}</span>
                          <span className="text-ink-muted">--&gt;</span>
                          <span className="font-medium">{rel.to_entity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={handleApplyAndOpen}
                className="w-full py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={14} />
                Confirm & Open Graph ({acceptedEntities.size} entities, {acceptedRelationships.size} relationships)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectionStep({
  question,
  options,
  onSelect,
  selected,
}: {
  question: string;
  options: readonly { value: string; label: string; desc: string }[];
  onSelect: (value: string) => void;
  selected: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium text-ink mb-4">{question}</h2>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`w-full text-left p-3 rounded-lg border transition-all group ${
              selected === opt.value
                ? "border-accent bg-accent-bg"
                : "border-border hover:border-accent/30 hover:bg-accent-bg/50"
            }`}
          >
            <div className={`font-medium text-sm transition-colors ${
              selected === opt.value ? "text-accent" : "text-ink group-hover:text-accent"
            }`}>
              {opt.label}
            </div>
            <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
