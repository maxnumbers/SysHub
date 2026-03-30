import { useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { extractEntities } from "../../api/client";

export function TextInputModal() {
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layers = useGraphStore((s) => s.layers);
  const nodes = useGraphStore((s) => s.nodes);
  const setTextInputOpen = useUIStore((s) => s.setTextInputOpen);
  const setExtractionReviewOpen = useUIStore((s) => s.setExtractionReviewOpen);
  const addTranscript = useGraphStore((s) => s.addTranscript);
  const graphId = useGraphStore((s) => s.graphId);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setExtracting(true);
    setError(null);

    try {
      // Create a synthetic transcript from the text input
      const transcriptId = `t-text-${Date.now()}`;
      addTranscript({
        id: transcriptId,
        graphId: graphId || "",
        title: `Text input - ${new Date().toLocaleDateString()}`,
        audioPath: null,
        segments: [{
          id: "seg-0",
          transcriptId,
          speakerLabel: null,
          text: text.trim(),
          startTime: 0,
          endTime: 0,
          confidenceScore: 1.0,
          reviewed: true,
        }],
        createdAt: new Date().toISOString(),
      });

      // Close text modal and open extraction review
      setTextInputOpen(false);
      setExtractionReviewOpen(true);
    } catch (err: any) {
      setError(err.message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="bg-paper rounded-2xl border border-border shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-accent" />
            <h2 className="text-lg font-medium text-ink">Describe your system</h2>
          </div>
          <button
            onClick={() => setTextInputOpen(false)}
            className="p-1 rounded hover:bg-paper-darker text-ink-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm text-ink-muted mb-3">
            Type or paste a description of your system. This can be meeting notes, documentation,
            or a free-form description. The system will extract entities and relationships from your text.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste existing documentation, meeting notes, or describe your system here..."
            className="w-full px-3 py-2 text-sm bg-paper-dark border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            rows={12}
            autoFocus
          />

          {error && (
            <p className="text-sm text-danger mt-2">{error}</p>
          )}

          <div className="flex justify-between items-center mt-4">
            <span className="text-xs text-ink-muted">
              {text.trim().split(/\s+/).filter(Boolean).length} words
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setTextInputOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-ink-muted hover:bg-paper-darker transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExtract}
                disabled={extracting || !text.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {extracting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Extract Entities"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
