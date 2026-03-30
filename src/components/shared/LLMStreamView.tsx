import { useEffect, useRef, useState } from "react";

interface Props {
  /** Whether the LLM is currently processing */
  active: boolean;
  /** Optional status text above the stream */
  statusText?: string;
  /** Optional custom class */
  className?: string;
}

/**
 * A sliding window view of simulated LLM thinking output.
 * Shows the last 2-3 sentences of "thinking" text to give users
 * feedback that the model is processing their input.
 *
 * Since we're using instructor (structured output) which doesn't
 * easily support partial streaming, this simulates the thinking
 * process with realistic analysis phrases.
 */
export function LLMStreamView({ active, statusText, className = "" }: Props) {
  const [displayText, setDisplayText] = useState("");
  const [phase, setPhase] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const THINKING_PHASES = [
    "Analyzing input text for entities and relationships...",
    "Identifying key people, tools, and processes mentioned...",
    "Mapping entities to suggested layers based on context...",
    "Detecting relationships between identified entities...",
    "Checking for potential aliases and duplicate names...",
    "Evaluating confidence scores for each extraction...",
    "Cross-referencing with existing graph entities...",
    "Generating structured output with entity details...",
    "Validating relationship types and directions...",
    "Finalizing extraction results...",
  ];

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayText("");
      setPhase(0);
      return;
    }

    let currentPhase = 0;
    let charIndex = 0;
    let currentText = "";

    const tick = () => {
      const phaseText = THINKING_PHASES[currentPhase % THINKING_PHASES.length];

      if (charIndex < phaseText.length) {
        // Typing effect: add characters one at a time
        currentText += phaseText[charIndex];
        charIndex++;
        setDisplayText(currentText);
      } else {
        // Phase complete, pause then move to next
        currentPhase++;
        charIndex = 0;
        // Keep only the last 2 lines visible (sliding window)
        const lines = currentText.split("\n");
        if (lines.length > 2) {
          currentText = lines.slice(-2).join("\n");
        }
        currentText += "\n";
        setPhase(currentPhase);
      }
    };

    // Vary typing speed slightly for realism
    intervalRef.current = setInterval(tick, 25 + Math.random() * 15);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayText]);

  if (!active) return null;

  return (
    <div className={`rounded-lg border border-border bg-paper-darker overflow-hidden ${className}`}>
      {statusText && (
        <div className="px-3 py-1.5 text-xs font-medium text-ink-muted border-b border-border flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          {statusText}
        </div>
      )}
      <div
        ref={containerRef}
        className="px-3 py-2 font-mono text-xs text-ink-muted leading-relaxed max-h-[80px] overflow-y-auto"
      >
        {displayText}
        <span className="inline-block w-1.5 h-3 bg-accent/60 animate-pulse ml-0.5 align-text-bottom" />
      </div>
    </div>
  );
}
