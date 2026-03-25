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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══ Config ═══
# Default to Cerebras; user can change via settings endpoint
_settings = {
    "llm_model": os.environ.get("SYSHUB_LLM_MODEL", "cerebras/llama3.1-8b"),
    "speech_provider": os.environ.get("SYSHUB_SPEECH_PROVIDER", "deepgram"),
}

AVAILABLE_MODELS = [
    "cerebras/llama3.1-8b",
    "cerebras/qwen-3-235b-a22b-instruct-2507",
    "cerebras/gpt-oss-120b",
    "anthropic/claude-sonnet-4-20250514",
    "anthropic/claude-haiku-4-5-20251001",
    "ollama/llama3",
]

AVAILABLE_SPEECH = ["deepgram", "assemblyai"]

# Patch litellm client with instructor for structured output
client = instructor.from_litellm(litellm.completion)


# ═══ Settings ═══

@app.get("/api/settings", response_model=SettingsResponse)
async def get_settings():
    return SettingsResponse(
        llm_model=_settings["llm_model"],
        speech_provider=_settings["speech_provider"],
        available_models=AVAILABLE_MODELS,
        available_speech_providers=AVAILABLE_SPEECH,
    )


@app.patch("/api/settings", response_model=SettingsResponse)
async def update_settings(req: UpdateSettingsRequest):
    if req.llm_model is not None:
        _settings["llm_model"] = req.llm_model
    if req.speech_provider is not None:
        if req.speech_provider not in AVAILABLE_SPEECH:
            raise HTTPException(400, f"Unknown speech provider: {req.speech_provider}")
        _settings["speech_provider"] = req.speech_provider
    return await get_settings()


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
    from deepgram import DeepgramClient

    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise HTTPException(500, "DEEPGRAM_API_KEY not set")

    dg = DeepgramClient(api_key=api_key)

    options = {
        "model": "nova-3",
        "smart_format": True,
        "utterances": True,
        "punctuate": True,
        "diarize": True,
    }

    source = {"buffer": audio_bytes, "mimetype": "audio/webm"}
    response = dg.listen.rest.v("1").transcribe_file(source, options)

    # Convert to our standard segment format
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
    import assemblyai as aai

    api_key = os.environ.get("ASSEMBLY_AI_API_KEY")
    if not api_key:
        raise HTTPException(500, "ASSEMBLY_AI_API_KEY not set")

    aai.settings.api_key = api_key

    # Write to temp file (AssemblyAI SDK needs a file path or URL)
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
            raise HTTPException(500, f"Transcription failed: {transcript.error}")

        segments = []
        if transcript.utterances:
            for utt in transcript.utterances:
                segments.append({
                    "id": f"seg-{len(segments)}",
                    "speakerLabel": f"Speaker {utt.speaker}",
                    "text": utt.text,
                    "startTime": utt.start / 1000,  # ms to seconds
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


# ═══ Entity Extraction ═══

@app.post("/api/extract")
async def extract_entities(req: ExtractRequest):
    """Extract entities and relationships from transcript text using LLM."""
    model = _settings["llm_model"]

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


# ═══ Seed Extraction (text from warm start answers → nodes) ═══

@app.post("/api/seed-extract")
async def seed_extract(req: ExtractRequest):
    """Extract seed nodes from user's answers to warm start questions.
    Same as extract but with a simpler prompt focused on initial entity discovery."""
    return await extract_entities(req)


# ═══ Health ═══

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "llm_model": _settings["llm_model"],
        "speech_provider": _settings["speech_provider"],
        "has_deepgram_key": bool(os.environ.get("DEEPGRAM_API_KEY")),
        "has_assemblyai_key": bool(os.environ.get("ASSEMBLY_AI_API_KEY")),
        "has_anthropic_url": bool(os.environ.get("ANTHROPIC_BASE_URL")),
        "has_cerebras_key": bool(os.environ.get("CEREBRAS_GPT_OSS_API_KEY")),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
