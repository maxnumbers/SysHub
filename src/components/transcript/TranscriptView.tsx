import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";

export function TranscriptView() {
  const transcripts = useGraphStore((s) => s.transcripts);
  const setExtractionReview = useUIStore((s) => s.setExtractionReviewOpen);

  if (transcripts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-paper">
        <div className="text-center text-ink-muted">
          <p className="text-sm font-medium mb-1">No transcripts yet</p>
          <p className="text-xs">Record audio or paste text to create a transcript.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {transcripts.map((transcript) => {
          const unreviewedCount = transcript.segments.filter((s) => !s.reviewed).length;
          const lowConfCount = transcript.segments.filter((s) => s.confidenceScore < 0.8).length;

          return (
            <div key={transcript.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-ink">{transcript.title}</h3>
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  {unreviewedCount > 0 && (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertCircle size={12} />
                      {unreviewedCount} unreviewed
                    </span>
                  )}
                  {lowConfCount > 0 && (
                    <span className="flex items-center gap-1 text-danger">
                      {lowConfCount} low confidence
                    </span>
                  )}
                  <span>{new Date(transcript.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                {transcript.segments.map((segment) => (
                  <SegmentRow key={segment.id} segment={segment} />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExtractionReview(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Extract Entities →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SegmentRow({ segment }: { segment: { id: string; speakerLabel: string | null; text: string; startTime: number; endTime: number; confidenceScore: number; reviewed: boolean } }) {
  const isLow = segment.confidenceScore < 0.8;
  const isMedium = segment.confidenceScore >= 0.8 && segment.confidenceScore < 0.95;

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Highlight low-confidence words (simulate by highlighting certain words)
  const renderText = () => {
    if (isLow) {
      // For low confidence segments, highlight the whole segment
      return (
        <span className="bg-danger/10 border-b border-danger/30 px-0.5">
          {segment.text}
        </span>
      );
    }
    if (isMedium) {
      return (
        <span className="bg-warning/10 border-b border-warning/20 px-0.5">
          {segment.text}
        </span>
      );
    }
    return <span>{segment.text}</span>;
  };

  return (
    <div
      className={`flex gap-3 p-2 rounded-lg text-sm transition-colors ${
        isLow ? "bg-danger/5" : isMedium ? "bg-warning/5" : "hover:bg-paper-darker/50"
      }`}
    >
      <div className="flex items-start gap-2 shrink-0 w-24">
        <Clock size={12} className="text-ink-muted mt-1" />
        <span className="text-xs text-ink-muted font-mono">
          [{formatTime(segment.startTime)}]
        </span>
      </div>

      {segment.speakerLabel && (
        <span className="text-xs font-medium text-ink-light shrink-0 w-12">
          {segment.speakerLabel}
        </span>
      )}

      <div className="flex-1 text-sm text-ink leading-relaxed">
        {renderText()}
      </div>

      <div className="flex items-start gap-1 shrink-0">
        {segment.reviewed ? (
          <CheckCircle size={14} className="text-success" />
        ) : (
          <span
            className={`text-xs font-mono px-1 rounded ${
              isLow ? "text-danger" : isMedium ? "text-warning" : "text-ink-muted"
            }`}
          >
            {(segment.confidenceScore * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
