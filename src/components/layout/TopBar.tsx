import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGraphStore } from "../../store/graphStore";
import { useLibraryStore } from "../../store/libraryStore";
import { useUIStore } from "../../store/uiStore";
import { transcribeAudio } from "../../api/client";
import type { Transcript } from "../../types";
import { ArrowLeft, Mic, MicOff, PanelLeft, PanelRight, Download, Settings, Loader2, FileText } from "lucide-react";

export function TopBar() {
  const navigate = useNavigate();
  const graphId = useGraphStore((s) => s.graphId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const transcripts = useGraphStore((s) => s.transcripts);
  const updateLibGraph = useLibraryStore((s) => s.updateGraph);
  const graphTitle = useLibraryStore((s) => {
    const g = s.graphs.find((g) => g.id === graphId);
    return g?.title || "Untitled Graph";
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(graphTitle);
  const toggleLeft = useUIStore((s) => s.toggleLeftSidebar);
  const toggleRight = useUIStore((s) => s.toggleRightSidebar);
  const setExtractionReview = useUIStore((s) => s.setExtractionReviewOpen);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Your browser does not support audio recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick a supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const actualMime = mediaRecorder.mimeType || "audio/webm";
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: actualMime });
        await handleTranscription(blob);
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Microphone access failed: ${msg}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [recording]);

  const handleTranscription = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const speechProvider = useUIStore.getState().speechProvider;
      const result = await transcribeAudio(blob, speechProvider);

      // Add transcript to the graph store
      const store = useGraphStore.getState();
      const transcript: Transcript = {
        id: `t-${Date.now()}`,
        graphId: store.graphId || "",
        title: `Recording — ${new Date().toLocaleString()}`,
        audioPath: null,
        segments: result.segments.map((seg, i) => ({
          ...seg,
          id: seg.id || `seg-${Date.now()}-${i}`,
          transcriptId: `t-${Date.now()}`,
        })),
        createdAt: new Date().toISOString(),
      };

      store.addTranscript(transcript);
      setViewMode("transcript");
    } catch (err) {
      console.error("Transcription failed:", err);
      alert(`Transcription failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTranscribing(false);
    }
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const handleExport = (format: "json" | "mermaid") => {
    const data = format === "json" ? exportJSON() : exportMermaid();
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph.${format === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const store = useGraphStore.getState();
    return JSON.stringify({
      graphId: store.graphId,
      layers: store.layers,
      nodes: store.nodes,
      edges: store.edges,
    }, null, 2);
  };

  const exportMermaid = () => {
    const store = useGraphStore.getState();
    const lines = ["graph TD"];
    for (const node of store.nodes) {
      const safe = node.id.replace(/-/g, "_");
      lines.push(`    ${safe}["${node.name}"]`);
    }
    for (const edge of store.edges) {
      const from = edge.fromNodeId.replace(/-/g, "_");
      const to = edge.toNodeId.replace(/-/g, "_");
      const label = edge.relationship ? `|${edge.relationship}|` : "";
      lines.push(`    ${from} -->${label} ${to}`);
    }
    return lines.join("\n");
  };

  return (
    <header className="h-12 bg-paper border-b border-border flex items-center px-3 gap-2 shrink-0">
      <button
        onClick={() => { useGraphStore.getState().saveCurrentGraph(); navigate("/"); }}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Back to library"
      >
        <ArrowLeft size={18} />
      </button>

      <button
        onClick={toggleLeft}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Toggle left sidebar"
      >
        <PanelLeft size={18} />
      </button>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Editable title */}
      {editingTitle ? (
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            if (titleDraft.trim() && graphId) {
              updateLibGraph(graphId, { title: titleDraft.trim() });
            }
            setEditingTitle(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setTitleDraft(graphTitle); setEditingTitle(false); }
          }}
          className="text-sm font-medium text-ink bg-paper-dark border border-accent rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent min-w-[120px]"
          autoFocus
        />
      ) : (
        <span
          onClick={() => { setTitleDraft(graphTitle); setEditingTitle(true); }}
          className="text-sm font-medium text-ink truncate cursor-text hover:bg-paper-darker px-1.5 py-0.5 rounded transition-colors"
          title="Click to rename"
        >
          {graphTitle}
        </span>
      )}

      <span className="text-xs text-ink-muted ml-1">
        {nodes.length} nodes · {edges.length} edges
      </span>

      <div className="flex-1" />

      {/* Extraction review trigger -- only show when transcripts exist */}
      {transcripts.length > 0 && (
        <button
          onClick={() => setExtractionReview(true)}
          className="px-2.5 py-1 text-xs font-medium rounded bg-accent-bg text-accent border border-accent/20 hover:bg-accent/10 transition-colors"
        >
          Extract Entities
        </button>
      )}

      {/* Mic button */}
      {transcribing ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          Transcribing...
        </div>
      ) : recording ? (
        <button
          onClick={stopRecording}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-danger/10 text-danger border border-danger/20 transition-colors"
          title="Stop recording"
        >
          <MicOff size={14} />
          <span className="text-xs font-mono">{formatTime(recordingTime)}</span>
        </button>
      ) : (
        <button
          onClick={startRecording}
          className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
          title="Start dictation"
        >
          <Mic size={18} />
        </button>
      )}

      {/* Text input button */}
      <button
        onClick={() => useUIStore.getState().setTextInputOpen(true)}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Describe in text"
      >
        <FileText size={18} />
      </button>

      {/* Export dropdown */}
      <div className="relative group">
        <button
          className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
          title="Export"
        >
          <Download size={18} />
        </button>
        <div className="absolute right-0 top-full mt-1 bg-paper border border-border rounded-lg shadow-lg py-1 min-w-[120px] hidden group-hover:block z-50">
          <button
            onClick={() => handleExport("json")}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-darker"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport("mermaid")}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-paper-darker"
          >
            Export Mermaid
          </button>
        </div>
      </div>

      {/* Settings */}
      <button
        onClick={() => setSettingsOpen(!settingsOpen)}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Settings"
      >
        <Settings size={18} />
      </button>

      <div className="h-5 w-px bg-border mx-1" />

      <button
        onClick={toggleRight}
        className="p-1.5 rounded hover:bg-paper-darker text-ink-muted hover:text-ink transition-colors"
        title="Toggle inspector"
      >
        <PanelRight size={18} />
      </button>
    </header>
  );
}
