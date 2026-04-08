"""SysHub FastAPI backend — LLM extraction + speech transcription."""
import os
import json
import tempfile
from pathlib import Path

# Map env var names for LiteLLM compatibility
if os.environ.get("CEREBRAS_GPT_OSS_API_KEY") and not os.environ.get("CEREBRAS_API_KEY"):
    os.environ["CEREBRAS_API_KEY"] = os.environ["CEREBRAS_GPT_OSS_API_KEY"]

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import litellm
import instructor

from models import (
    ExtractionResult, WarmStartResult,
    ExtractRequest, WarmStartRequest,
    SettingsResponse, UpdateSettingsRequest,
)

app = FastAPI(title="SysHub API", version="0.1.0")

@app.on_event("startup")
async def _snapshot_env():
    """Remember which API key env vars existed at startup, then apply persisted keys."""
    for env_var in PROVIDER_KEY_MAP.values():
        if os.environ.get(env_var):
            _original_env_keys.add(env_var)
    # Apply persisted API keys to environment so LiteLLM can use them
    for env_var, key in _user_keys.items():
        if key:
            os.environ[env_var] = key

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══ Config ═══

_DATA_DIR = Path(os.environ.get("SYSHUB_DATA_DIR", str(Path.home() / ".syshub")))
_SETTINGS_FILE = _DATA_DIR / "settings.json"

def _load_persisted_settings() -> tuple[dict, dict[str, str]]:
    """Load settings and API keys from disk, falling back to env vars."""
    defaults = {
        "llm_model": os.environ.get("SYSHUB_LLM_MODEL", ""),
        "speech_provider": os.environ.get("SYSHUB_SPEECH_PROVIDER", "deepgram"),
    }
    saved_keys: dict[str, str] = {}
    try:
        if _SETTINGS_FILE.exists():
            with open(_SETTINGS_FILE) as f:
                saved = json.load(f)
            for k in defaults:
                if k in saved and saved[k]:
                    defaults[k] = saved[k]
            # Load persisted API keys
            saved_keys = saved.get("api_keys", {})
    except Exception:
        pass
    return defaults, saved_keys

def _persist_settings():
    """Write settings and API keys to disk."""
    try:
        _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_SETTINGS_FILE, "w") as f:
            json.dump({
                "llm_model": _settings["llm_model"],
                "speech_provider": _settings["speech_provider"],
                "api_keys": _user_keys,
            }, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to persist settings to {_SETTINGS_FILE}: {e}")

_settings, _loaded_keys = _load_persisted_settings()

# API keys set by user via the UI, persisted to settings.json.
# Keyed by the env var name that LiteLLM expects (e.g., "ANTHROPIC_API_KEY").
_user_keys: dict[str, str] = _loaded_keys

# Snapshot of env vars present at startup (so we don't delete pre-existing ones)
_original_env_keys: set[str] = set()

# Well-known providers and the env var LiteLLM expects for each.
PROVIDER_KEY_MAP = {
    "anthropic":  "ANTHROPIC_API_KEY",
    "openai":     "OPENAI_API_KEY",
    "cerebras":   "CEREBRAS_API_KEY",
    "groq":       "GROQ_API_KEY",
    "together_ai":"TOGETHERAI_API_KEY",
    "fireworks_ai":"FIREWORKS_AI_API_KEY",
    "mistral":    "MISTRAL_API_KEY",
    "cohere":     "COHERE_API_KEY",
    "deepseek":   "DEEPSEEK_API_KEY",
    "google":     "GEMINI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "perplexity": "PERPLEXITYAI_API_KEY",
    "deepgram":   "DEEPGRAM_API_KEY",
    "assemblyai": "ASSEMBLY_AI_API_KEY",
}

PRESET_MODELS = [
    "anthropic/claude-sonnet-4-20250514",
    "anthropic/claude-haiku-4-5-20251001",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4.1-mini",
    "cerebras/llama-3.3-70b",
    "groq/llama-3.3-70b-versatile",
    "groq/llama-3.1-8b-instant",
    "together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "fireworks_ai/accounts/fireworks/models/llama-v3p1-70b-instruct",
    "deepseek/deepseek-chat",
    "mistral/mistral-large-latest",
    "google/gemini-2.0-flash",
    "openrouter/auto",
    "ollama/llama3",
]

AVAILABLE_SPEECH = ["deepgram", "assemblyai"]

# Patch litellm client with instructor for structured output
client = instructor.from_litellm(litellm.completion)


def _get_key(provider: str) -> str | None:
    """Get API key for a provider: user-set keys first, then env vars."""
    env_var = PROVIDER_KEY_MAP.get(provider)
    if not env_var:
        return None
    # User-set key takes priority
    if env_var in _user_keys and _user_keys[env_var]:
        return _user_keys[env_var]
    # Fall back to environment
    return os.environ.get(env_var)


def _apply_user_keys_to_env():
    """Push user-set keys into os.environ so LiteLLM picks them up."""
    for env_var, key in _user_keys.items():
        if key:
            os.environ[env_var] = key


def _provider_from_model(model: str) -> str:
    """Extract provider name from a LiteLLM model string like 'anthropic/claude-...'."""
    if "/" in model:
        return model.split("/")[0]
    return model


def _configured_providers() -> dict[str, bool]:
    """Return which providers have keys configured (from user or env)."""
    result = {}
    for provider, env_var in PROVIDER_KEY_MAP.items():
        has_user_key = bool(_user_keys.get(env_var))
        has_env_key = bool(os.environ.get(env_var))
        result[provider] = has_user_key or has_env_key
    return result


# ═══ Settings & Keys ═══

@app.get("/api/settings")
async def get_settings():
    providers = _configured_providers()
    return {
        "llm_model": _settings["llm_model"],
        "speech_provider": _settings["speech_provider"],
        "preset_models": PRESET_MODELS,
        "available_speech_providers": AVAILABLE_SPEECH,
        "configured_providers": providers,
    }


@app.patch("/api/settings")
async def update_settings(req: UpdateSettingsRequest):
    if req.llm_model is not None:
        _settings["llm_model"] = req.llm_model
    if req.speech_provider is not None:
        if req.speech_provider not in AVAILABLE_SPEECH:
            raise HTTPException(400, f"Unknown speech provider: {req.speech_provider}")
        _settings["speech_provider"] = req.speech_provider
    _persist_settings()
    return await get_settings()


@app.put("/api/keys/{provider}")
async def set_api_key(provider: str, body: dict):
    """Set an API key for a provider. The key is stored in memory only."""
    key = body.get("key", "").strip()
    env_var = PROVIDER_KEY_MAP.get(provider)
    if not env_var:
        # Allow arbitrary env var names for custom providers
        env_var = body.get("env_var", f"{provider.upper()}_API_KEY")

    _user_keys[env_var] = key
    # Also push into os.environ so LiteLLM picks it up
    if key:
        os.environ[env_var] = key
    elif env_var in os.environ and env_var not in {v for v in os.environ if not _user_keys.get(v)}:
        # Don't delete env vars that were set before the app started
        pass

    _persist_settings()
    return {"provider": provider, "env_var": env_var, "key_set": bool(key)}


@app.delete("/api/keys/{provider}")
async def remove_api_key(provider: str):
    """Remove a user-set API key for a provider."""
    env_var = PROVIDER_KEY_MAP.get(provider, f"{provider.upper()}_API_KEY")
    if env_var in _user_keys:
        _user_keys.pop(env_var, None)
        if env_var in os.environ and env_var not in _original_env_keys:
            del os.environ[env_var]
    _persist_settings()
    return {"provider": provider, "removed": True}


@app.get("/api/keys")
async def list_keys():
    """List which providers have keys set (never returns the actual keys)."""
    return _configured_providers()


# ═══ Transcription ═══

@app.post("/api/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    provider: str = Form("deepgram"),
):
    """Transcribe audio using Deepgram or AssemblyAI."""
    audio_bytes = await audio.read()

    if provider == "deepgram":
        return await _transcribe_deepgram(audio_bytes)
    elif provider == "assemblyai":
        return await _transcribe_assemblyai(audio_bytes)
    else:
        raise HTTPException(400, f"Unknown provider: {provider}")


async def _transcribe_deepgram(audio_bytes: bytes) -> dict:
    import asyncio
    from deepgram import DeepgramClient

    api_key = _get_key("deepgram")
    if not api_key:
        raise HTTPException(400, "No Deepgram API key configured. Set it in Settings.")

    dg = DeepgramClient(api_key=api_key)

    # Deepgram SDK v6: keyword-only args on listen.v1.media.transcribe_file
    response = await asyncio.to_thread(
        dg.listen.v1.media.transcribe_file,
        request=audio_bytes,
        model="nova-3",
        smart_format=True,
        utterances=True,
        punctuate=True,
        diarize=True,
    )

    segments = []
    results = response.results
    if results and hasattr(results, 'utterances') and results.utterances:
        for utt in results.utterances:
            segments.append({
                "id": f"seg-{len(segments)}",
                "speakerLabel": f"Speaker {utt.speaker}" if hasattr(utt, 'speaker') else None,
                "text": utt.transcript,
                "startTime": utt.start,
                "endTime": utt.end,
                "confidenceScore": utt.confidence,
                "reviewed": False,
            })
    elif results and hasattr(results, 'channels') and results.channels:
        for alt in results.channels[0].alternatives:
            words = alt.words or []
            segments.append({
                "id": "seg-0",
                "speakerLabel": None,
                "text": alt.transcript,
                "startTime": words[0].start if words else 0,
                "endTime": words[-1].end if words else 0,
                "confidenceScore": alt.confidence,
                "reviewed": False,
            })

    return {"segments": segments, "provider": "deepgram"}


async def _transcribe_assemblyai(audio_bytes: bytes) -> dict:
    import asyncio
    import assemblyai as aai

    api_key = _get_key("assemblyai")
    if not api_key:
        raise HTTPException(400, "No AssemblyAI API key configured. Set it in Settings.")

    def _run_sync():
        aai.settings.api_key = api_key
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            config = aai.TranscriptionConfig(
                speaker_labels=True,
                punctuate=True,
                format_text=True,
            )
            transcriber = aai.Transcriber()
            transcript = transcriber.transcribe(temp_path, config=config)

            if transcript.status == aai.TranscriptStatus.error:
                raise RuntimeError(f"Transcription failed: {transcript.error}")

            segments = []
            if transcript.utterances:
                for utt in transcript.utterances:
                    segments.append({
                        "id": f"seg-{len(segments)}",
                        "speakerLabel": f"Speaker {utt.speaker}",
                        "text": utt.text,
                        "startTime": utt.start / 1000,
                        "endTime": utt.end / 1000,
                        "confidenceScore": utt.confidence,
                        "reviewed": False,
                    })
            elif transcript.text:
                segments.append({
                    "id": "seg-0",
                    "speakerLabel": None,
                    "text": transcript.text,
                    "startTime": 0,
                    "endTime": 0,
                    "confidenceScore": transcript.confidence or 0.9,
                    "reviewed": False,
                })

            return {"segments": segments, "provider": "assemblyai"}
        finally:
            os.unlink(temp_path)

    return await asyncio.to_thread(_run_sync)


# ═══ Entity Extraction ═══

@app.post("/api/extract")
async def extract_entities(req: ExtractRequest):
    """Extract entities and relationships from transcript text using LLM."""
    model = _settings["llm_model"]
    if not model:
        raise HTTPException(400, "No LLM model configured. Set it in Settings.")

    # Ensure keys are in env for LiteLLM
    _apply_user_keys_to_env()

    existing_list = "\n".join(f"- {e}" for e in req.existing_entities) if req.existing_entities else "None yet."
    layers_list = "\n".join(f"- {l}" for l in req.layer_names)

    try:
        result = client.chat.completions.create(
            model=model,
            response_model=ExtractionResult,
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert systems analyst extracting structured knowledge from conversations.
Your job is to identify entities (people, tools, processes, concepts) and their relationships from transcript text.

Rules:
- Extract concrete, named entities — not abstract concepts
- Each entity should be assigned to one of the provided layers
- Relationships should describe how entities interact
- If a term in the transcript might refer to an existing entity, flag it as an alias candidate
- If the transcript discusses something that contradicts or updates existing documentation, flag it as stale
- Be conservative: only extract what's clearly stated or strongly implied
- Confidence scores: 0.9+ for explicit mentions, 0.7-0.9 for implied, below 0.7 for uncertain"""
                },
                {
                    "role": "user",
                    "content": f"""Extract entities and relationships from this transcript.

LAYERS available:
{layers_list}

EXISTING entities in the graph (check for aliases/duplicates):
{existing_list}

TRANSCRIPT:
\"\"\"
{req.transcript_text}
\"\"\"

Extract all entities, relationships, alias candidates, and stale documentation flags."""
                }
            ],
            max_tokens=4096,
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"Extraction failed: {str(e)}")


# ═══ Warm Start ═══

@app.post("/api/warm-start/suggest")
async def warm_start_suggest(req: WarmStartRequest):
    """Generate layer suggestions and seed questions based on user's frame/intent/scope."""
    model = _settings["llm_model"]
    if not model:
        raise HTTPException(400, "No LLM model configured. Set it in Settings.")

    _apply_user_keys_to_env()

    try:
        result = client.chat.completions.create(
            model=model,
            response_model=WarmStartResult,
            messages=[
                {
                    "role": "system",
                    "content": """You help people create knowledge graphs of systems they want to understand.
Given their framing (what kind of system), intent (why they're mapping it), and scope (who's involved),
suggest 3-6 layers that represent the conceptual levels of their system, and 3-5 seed questions per layer
to help them start describing the entities in each layer.

Layers should be concrete and actionable — think of them as categories of things the user will map.
Questions should help elicit specific, named entities (people, tools, processes) not abstract answers."""
                },
                {
                    "role": "user",
                    "content": f"""Help me set up a knowledge graph.

FRAME: I'm trying to understand {req.frame.replace('_', ' ')}
INTENT: {req.intent.replace('_', ' ')}
SCOPE: {req.scope}

Suggest layers and seed questions for this graph."""
                }
            ],
            max_tokens=2048,
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(500, f"Warm start suggestion failed: {str(e)}")


# ═══ Seed Extraction ═══

@app.post("/api/seed-extract")
async def seed_extract(req: ExtractRequest):
    """Extract seed nodes from user's answers to warm start questions."""
    return await extract_entities(req)


# ═══ Extraction Feedback ═══

@app.post("/api/extraction-feedback")
async def extraction_feedback(feedback: dict):
    """Record user feedback on extraction results for quality tracking."""
    feedback_dir = Path(os.environ.get("SYSHUB_DATA_DIR", "."))
    feedback_file = feedback_dir / "extraction_feedback.jsonl"
    entry = {
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "accepted": feedback.get("accepted", []),
        "rejected": feedback.get("rejected", []),
        "edited": feedback.get("edited", []),
    }
    try:
        with open(feedback_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass  # Non-critical: don't fail the request if logging fails
    return {"status": "recorded"}


# ═══ ASR Corrections ═══

@app.post("/api/asr-corrections")
async def asr_corrections(body: dict):
    """Record ASR correction feedback for quality tracking."""
    feedback_dir = Path(os.environ.get("SYSHUB_DATA_DIR", "."))
    corrections_file = feedback_dir / "asr_corrections.jsonl"
    entry = {
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        "corrections": body.get("corrections", []),
    }
    try:
        with open(corrections_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass
    return {"status": "recorded"}


# ═══ Health ═══

@app.get("/api/health")
async def health():
    providers = _configured_providers()
    return {
        "status": "ok",
        "llm_model": _settings["llm_model"],
        "speech_provider": _settings["speech_provider"],
        "configured_providers": providers,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
