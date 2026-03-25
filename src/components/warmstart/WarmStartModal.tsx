import { useState } from "react";
import { X, ArrowLeft, Plus, GripVertical, Trash2, Loader2 } from "lucide-react";
import { useLibraryStore } from "../../store/libraryStore";
import { useGraphStore } from "../../store/graphStore";
import { suggestWarmStart } from "../../api/client";
import type { Graph, Layer } from "../../types";

interface Props {
  onComplete: (graphId: string) => void;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

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
  const [_scope, setScope] = useState<string>("");
  const [title, setTitle] = useState("");
  const [layerNames, setLayerNames] = useState<string[]>([]);

  const addGraph = useLibraryStore((s) => s.addGraph);
  const loadEmpty = useGraphStore((s) => s.loadEmpty);

  const handleFrameSelect = (value: string) => {
    setFrame(value);
    setStep(2);
  };

  const handleIntentSelect = (value: string) => {
    setIntent(value);
    setStep(3);
  };

  const [suggestingLayers, setSuggestingLayers] = useState(false);

  const handleScopeSelect = async (value: string) => {
    setScope(value);
    setStep(4);

    // Try LLM-powered suggestions first, fall back to static lookup
    setSuggestingLayers(true);
    try {
      const result = await suggestWarmStart({ frame, intent, scope: value });
      setLayerNames(result.layers.map((l) => l.name));
    } catch {
      // Fallback to static suggestions
      const key = `${frame}|${intent}`;
      const suggested = LAYER_SUGGESTIONS[key] || ["Layer 1", "Layer 2", "Layer 3"];
      setLayerNames(suggested);
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
    onComplete(graphId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="bg-paper rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="p-1 rounded hover:bg-paper-darker text-ink-muted"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="text-xs text-ink-muted font-medium">Step {step} of 4</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-paper-darker text-ink-muted">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 mb-4 h-1 bg-paper-darker rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="px-5 pb-5">
          {step === 1 && (
            <SelectionStep
              question="What are you trying to understand?"
              options={FRAME_OPTIONS}
              onSelect={handleFrameSelect}
            />
          )}
          {step === 2 && (
            <SelectionStep
              question="What's driving you to map this?"
              options={INTENT_OPTIONS}
              onSelect={handleIntentSelect}
            />
          )}
          {step === 3 && (
            <SelectionStep
              question="Who else is part of this?"
              options={SCOPE_OPTIONS}
              onSelect={handleScopeSelect}
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
                  Generating layer suggestions via LLM...
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
                Create Graph
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
}: {
  question: string;
  options: readonly { value: string; label: string; desc: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-medium text-ink mb-4">{question}</h2>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="w-full text-left p-3 rounded-lg border border-border hover:border-accent/30 hover:bg-accent-bg/50 transition-all group"
          >
            <div className="font-medium text-sm text-ink group-hover:text-accent transition-colors">
              {opt.label}
            </div>
            <div className="text-xs text-ink-muted mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
