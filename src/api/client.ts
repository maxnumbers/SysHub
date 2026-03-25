/**
 * API client for the SysHub FastAPI backend.
 * All calls go through /api/* which Vite proxies to localhost:8000.
 */

export interface TranscribeSegment {
  id: string;
  speakerLabel: string | null;
  text: string;
  startTime: number;
  endTime: number;
  confidenceScore: number;
  reviewed: boolean;
}

export interface TranscribeResponse {
  segments: TranscribeSegment[];
  provider: string;
}

export interface ExtractRequest {
  transcript_text: string;
  layer_names: string[];
  existing_entities: string[];
}

export interface ExtractedEntity {
  name: string;
  suggested_layer: string;
  properties: Record<string, string>;
  confidence: number;
}

export interface ExtractedRelationship {
  from_entity: string;
  to_entity: string;
  relationship: string;
  type: string;
  confidence: number;
}

export interface AliasCandidate {
  new_term: string;
  existing_entity: string;
  similarity_reason: string;
  confidence: number;
}

export interface StaleDocFlag {
  entity_name: string;
  reason: string;
  suggested_update: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  alias_candidates: AliasCandidate[];
  stale_doc_flags: StaleDocFlag[];
}

export interface WarmStartRequest {
  frame: string;
  intent: string;
  scope: string;
}

export interface SuggestedLayer {
  name: string;
  description: string;
}

export interface SeedQuestion {
  layer_name: string;
  questions: string[];
}

export interface WarmStartResult {
  layers: SuggestedLayer[];
  seed_questions: SeedQuestion[];
}

export interface AppSettings {
  llm_model: string;
  speech_provider: string;
  available_models: string[];
  available_speech_providers: string[];
}

export interface HealthResponse {
  status: string;
  llm_model: string;
  speech_provider: string;
  has_deepgram_key: boolean;
  has_assemblyai_key: boolean;
  has_anthropic_url: boolean;
  has_cerebras_key: boolean;
}

// ═══ API Functions ═══

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  return handleResponse(res);
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch("/api/settings");
  return handleResponse(res);
}

export async function updateSettings(
  updates: { llm_model?: string; speech_provider?: string }
): Promise<AppSettings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
}

export async function transcribeAudio(
  audioBlob: Blob,
  provider: string = "deepgram"
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("provider", provider);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function extractEntities(
  req: ExtractRequest
): Promise<ExtractionResult> {
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

export async function suggestWarmStart(
  req: WarmStartRequest
): Promise<WarmStartResult> {
  const res = await fetch("/api/warm-start/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}
