"""Pydantic models for structured LLM output via Instructor."""
from pydantic import BaseModel, Field


# ═══ Extraction Models ═══

class ExtractedEntity(BaseModel):
    """An entity extracted from transcript text."""
    name: str = Field(description="The canonical name of the entity")
    suggested_layer: str = Field(description="Which layer this entity belongs to (use the layer name, not ID)")
    properties: dict[str, str] = Field(default_factory=dict, description="Key-value properties of the entity")
    confidence: float = Field(ge=0, le=1, description="Confidence that this is a real entity worth tracking")


class ExtractedRelationship(BaseModel):
    """A relationship between two entities."""
    from_entity: str = Field(description="Name of the source entity")
    to_entity: str = Field(description="Name of the target entity")
    relationship: str = Field(description="Label for this relationship (e.g., 'manages', 'depends on')")
    type: str = Field(description="Category of relationship (e.g., 'structural', 'data-flow', 'communication')")
    confidence: float = Field(ge=0, le=1, description="Confidence in this relationship")


class AliasCandidate(BaseModel):
    """A potential alias match between a new term and an existing entity."""
    new_term: str = Field(description="The new term found in the transcript")
    existing_entity: str = Field(description="The existing entity name it might refer to")
    similarity_reason: str = Field(description="Why these might be the same thing")
    confidence: float = Field(ge=0, le=1)


class StaleDocFlag(BaseModel):
    """A flag that existing documentation may be outdated based on the transcript."""
    entity_name: str = Field(description="Name of the entity whose documentation may be stale")
    reason: str = Field(description="Why the documentation might be outdated")
    suggested_update: str = Field(description="Suggested text to update the documentation with")


class ExtractionResult(BaseModel):
    """Full extraction result from a transcript."""
    entities: list[ExtractedEntity] = Field(default_factory=list)
    relationships: list[ExtractedRelationship] = Field(default_factory=list)
    alias_candidates: list[AliasCandidate] = Field(default_factory=list)
    stale_doc_flags: list[StaleDocFlag] = Field(default_factory=list)


# ═══ Warm Start Models ═══

class SuggestedLayer(BaseModel):
    """A suggested layer for the graph ontology."""
    name: str = Field(description="Layer name")
    description: str = Field(description="Brief description of what belongs in this layer")


class SeedQuestion(BaseModel):
    """A seed question to help the user populate a layer."""
    layer_name: str = Field(description="Which layer this question helps populate")
    questions: list[str] = Field(description="3-5 questions to help the user describe entities in this layer")


class WarmStartResult(BaseModel):
    """LLM-generated warm start suggestions."""
    layers: list[SuggestedLayer] = Field(description="3-6 suggested layers for this graph")
    seed_questions: list[SeedQuestion] = Field(description="Seed questions for each layer")


# ═══ API Request/Response Models ═══

class TranscribeRequest(BaseModel):
    provider: str = "deepgram"  # "deepgram" or "assemblyai"


class ExtractRequest(BaseModel):
    transcript_text: str
    layer_names: list[str]
    existing_entities: list[str] = Field(default_factory=list)


class WarmStartRequest(BaseModel):
    frame: str  # organization, problem, decision, process
    intent: str  # not_working, explain, intervene, understand
    scope: str  # solo, team, stakeholders, absent


class SettingsResponse(BaseModel):
    llm_model: str
    speech_provider: str
    available_models: list[str]
    available_speech_providers: list[str]


class UpdateSettingsRequest(BaseModel):
    llm_model: str | None = None
    speech_provider: str | None = None
