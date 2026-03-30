import { useState, useCallback } from "react";

interface WordToken {
  text: string;
  confidence: number;
  index: number;
}

interface Props {
  /** The full text to display */
  text: string;
  /** Overall confidence score for the segment (0-1) */
  confidence: number;
  /** Callback when a word is corrected */
  onCorrection?: (original: string, corrected: string, confidence: number) => void;
  /** Whether the text is editable (for correction) */
  editable?: boolean;
  /** CSS class for the container */
  className?: string;
}

/**
 * Renders text with per-token confidence highlighting.
 * Words are highlighted based on the segment-level confidence:
 * - High (>0.95): normal text
 * - Medium (0.80-0.95): amber background, clickable to correct
 * - Low (<0.80): red background, clickable to correct
 *
 * Since most ASR providers return segment-level (not word-level) confidence,
 * we simulate word-level variation by applying slight jitter to create a
 * realistic distribution around the segment confidence.
 */
export function ConfidenceText({
  text,
  confidence,
  onCorrection,
  editable = true,
  className = "",
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());

  // Tokenize text into words
  const tokens: WordToken[] = text.split(/(\s+)/).filter(Boolean).map((word, idx) => {
    // Only non-whitespace tokens get confidence scores
    const isWord = /\S/.test(word);
    if (!isWord) {
      return { text: word, confidence: 1, index: idx };
    }

    // Simulate word-level confidence variation around the segment score
    // Shorter/unusual words get slightly lower confidence
    let wordConf = confidence;
    const len = word.replace(/[^a-zA-Z]/g, "").length;
    if (len <= 3 && confidence < 0.95) {
      wordConf = Math.max(0.3, confidence - 0.05 * (4 - len));
    }
    // Capitalize words that aren't at the start get slight penalty (likely proper nouns = harder)
    if (idx > 0 && /^[A-Z]/.test(word) && confidence < 0.95) {
      wordConf = Math.max(0.3, wordConf - 0.03);
    }

    return { text: word, confidence: wordConf, index: idx };
  });

  const handleWordClick = useCallback((token: WordToken) => {
    if (!editable || token.confidence >= 0.95) return;
    setEditingIndex(token.index);
    setEditValue(corrections.get(token.index) || token.text);
  }, [editable, corrections]);

  const handleEditConfirm = useCallback((token: WordToken) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== token.text) {
      setCorrections((prev) => {
        const next = new Map(prev);
        next.set(token.index, trimmed);
        return next;
      });
      onCorrection?.(token.text, trimmed, token.confidence);
    }
    setEditingIndex(null);
    setEditValue("");
  }, [editValue, onCorrection]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent, token: WordToken) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEditConfirm(token);
    }
    if (e.key === "Escape") {
      setEditingIndex(null);
      setEditValue("");
    }
  }, [handleEditConfirm]);

  return (
    <span className={`inline ${className}`}>
      {tokens.map((token) => {
        const isWhitespace = !/\S/.test(token.text);
        if (isWhitespace) {
          return <span key={token.index}>{token.text}</span>;
        }

        const corrected = corrections.get(token.index);
        const displayText = corrected || token.text;
        const isEditing = editingIndex === token.index;

        // Confidence tier
        const isLow = token.confidence < 0.80;
        const isMedium = token.confidence >= 0.80 && token.confidence < 0.95;
        const isHigh = token.confidence >= 0.95;
        const wasCorrected = !!corrected;

        if (isEditing) {
          return (
            <input
              key={token.index}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleEditConfirm(token)}
              onKeyDown={(e) => handleEditKeyDown(e, token)}
              className="inline-block px-1 py-0 text-sm border-b-2 border-accent bg-accent-bg outline-none min-w-[40px]"
              style={{ width: `${Math.max(40, editValue.length * 8)}px` }}
              autoFocus
            />
          );
        }

        if (wasCorrected) {
          return (
            <span
              key={token.index}
              className="bg-success/10 text-success border-b border-success/30 cursor-pointer"
              onClick={() => handleWordClick(token)}
              title={`Corrected from "${token.text}" (${Math.round(token.confidence * 100)}%)`}
            >
              {displayText}
            </span>
          );
        }

        if (isLow) {
          return (
            <span
              key={token.index}
              className="bg-danger/10 text-danger border-b border-danger/30 rounded-sm cursor-pointer hover:bg-danger/20 transition-colors"
              onClick={() => handleWordClick(token)}
              title={`Low confidence: ${Math.round(token.confidence * 100)}% -- click to correct`}
            >
              {displayText}
            </span>
          );
        }

        if (isMedium) {
          return (
            <span
              key={token.index}
              className="bg-warning/10 border-b border-warning/30 rounded-sm cursor-pointer hover:bg-warning/20 transition-colors"
              onClick={() => handleWordClick(token)}
              title={`Medium confidence: ${Math.round(token.confidence * 100)}% -- click to correct`}
            >
              {displayText}
            </span>
          );
        }

        // High confidence -- normal text
        return <span key={token.index}>{displayText}</span>;
      })}
    </span>
  );
}
