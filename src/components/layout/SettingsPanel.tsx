import { useEffect, useState } from "react";
import { useUIStore } from "../../store/uiStore";
import {
  checkHealth,
  getSettings,
  updateSettings,
  setApiKey,
  removeApiKey,
} from "../../api/client";
import { X, CheckCircle, XCircle, Eye, EyeOff, Save, Trash2, Loader2 } from "lucide-react";

/** Well-known LLM providers the user can configure. */
const LLM_PROVIDERS = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "cerebras", label: "Cerebras", placeholder: "" },
  { id: "groq", label: "Groq", placeholder: "gsk_..." },
  { id: "together_ai", label: "Together AI", placeholder: "" },
  { id: "fireworks_ai", label: "Fireworks AI", placeholder: "" },
  { id: "mistral", label: "Mistral", placeholder: "" },
  { id: "deepseek", label: "DeepSeek", placeholder: "" },
  { id: "google", label: "Google (Gemini)", placeholder: "" },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
  { id: "cohere", label: "Cohere", placeholder: "" },
  { id: "perplexity", label: "Perplexity", placeholder: "" },
];

const SPEECH_PROVIDERS = [
  { id: "deepgram", label: "Deepgram", placeholder: "" },
  { id: "assemblyai", label: "AssemblyAI", placeholder: "" },
];

export function SettingsPanel() {
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const speechProvider = useUIStore((s) => s.speechProvider);
  const setSpeechProvider = useUIStore((s) => s.setSpeechProvider);
  const llmModel = useUIStore((s) => s.llmModel);
  const setLlmModel = useUIStore((s) => s.setLlmModel);

  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [configuredProviders, setConfiguredProviders] = useState<Record<string, boolean>>({});
  const [presetModels, setPresetModels] = useState<string[]>([]);
  const [modelInput, setModelInput] = useState(llmModel);

  // Per-provider key drafts (what the user is typing — never sent until Save)
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    checkHealth()
      .then((h) => {
        setBackendAvailable(true);
        setConfiguredProviders(h.configured_providers || {});
      })
      .catch(() => setBackendAvailable(false));

    getSettings()
      .then((s) => {
        setPresetModels(s.preset_models || []);
        setConfiguredProviders(s.configured_providers || {});
        if (s.llm_model) {
          setLlmModel(s.llm_model);
          setModelInput(s.llm_model);
        }
        if (s.speech_provider) setSpeechProvider(s.speech_provider);
      })
      .catch(() => {});
  }, []);

  const handleSaveKey = async (provider: string) => {
    const key = keyDrafts[provider]?.trim();
    if (!key) return;
    setSaving(provider);
    try {
      await setApiKey(provider, key);
      setConfiguredProviders((prev) => ({ ...prev, [provider]: true }));
      setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
    } catch (err) {
      console.error(`Failed to set key for ${provider}:`, err);
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveKey = async (provider: string) => {
    setSaving(provider);
    try {
      await removeApiKey(provider);
      setConfiguredProviders((prev) => ({ ...prev, [provider]: false }));
    } catch (err) {
      console.error(`Failed to remove key for ${provider}:`, err);
    } finally {
      setSaving(null);
    }
  };

  const handleModelSave = async () => {
    const model = modelInput.trim();
    if (!model) return;
    setLlmModel(model);
    try {
      await updateSettings({ llm_model: model });
    } catch (err) {
      console.error("Failed to update model:", err);
    }
  };

  const handleSpeechChange = async (provider: string) => {
    setSpeechProvider(provider);
    try {
      await updateSettings({ speech_provider: provider });
    } catch (err) {
      console.error("Failed to update speech provider:", err);
    }
  };

  // Determine which provider the current model requires
  const modelProvider = modelInput.includes("/") ? modelInput.split("/")[0] : "";
  const modelProviderConfigured = modelProvider ? configuredProviders[modelProvider] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="bg-paper rounded-2xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-ink">Settings</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-paper-darker text-ink-muted">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Backend status */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Backend</h3>
            <div className="flex items-center gap-2 text-sm">
              {backendAvailable === null ? (
                <span className="text-ink-muted">Checking...</span>
              ) : backendAvailable ? (
                <>
                  <CheckCircle size={14} className="text-success" />
                  <span className="text-success">Connected</span>
                </>
              ) : (
                <>
                  <XCircle size={14} className="text-danger" />
                  <span className="text-danger text-xs">
                    Not available — run <code className="bg-paper-darker px-1 rounded">python3 backend/main.py</code>
                  </span>
                </>
              )}
            </div>
          </section>

          {/* LLM Model */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">LLM Model</h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onBlur={handleModelSave}
                  onKeyDown={(e) => e.key === "Enter" && handleModelSave()}
                  placeholder="provider/model-name"
                  list="preset-models"
                  className="w-full text-sm bg-paper-dark border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <datalist id="preset-models">
                  {presetModels.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Provider key status for chosen model */}
            {modelProvider && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {modelProviderConfigured === true && (
                  <>
                    <CheckCircle size={11} className="text-success" />
                    <span className="text-success">{modelProvider} key configured</span>
                  </>
                )}
                {modelProviderConfigured === false && (
                  <>
                    <XCircle size={11} className="text-danger" />
                    <span className="text-danger">
                      No {modelProvider} key — set it below
                    </span>
                  </>
                )}
              </div>
            )}

            <p className="text-xs text-ink-muted mt-1">
              Any <a href="https://docs.litellm.ai/docs/providers" target="_blank" rel="noopener" className="underline">LiteLLM-compatible</a> model string. Type freely or pick from suggestions.
            </p>
          </section>

          {/* LLM API Keys */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">LLM API Keys</h3>
            <p className="text-xs text-ink-muted mb-3">
              Enter the API key for any provider you want to use. Keys are stored in the backend process memory only — they are never persisted to disk.
            </p>
            <div className="space-y-2">
              {LLM_PROVIDERS.map((p) => (
                <KeyRow
                  key={p.id}
                  provider={p}
                  configured={!!configuredProviders[p.id]}
                  draft={keyDrafts[p.id] || ""}
                  visible={!!keyVisible[p.id]}
                  saving={saving === p.id}
                  onDraftChange={(v) => setKeyDrafts((prev) => ({ ...prev, [p.id]: v }))}
                  onToggleVisible={() => setKeyVisible((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                  onSave={() => handleSaveKey(p.id)}
                  onRemove={() => handleRemoveKey(p.id)}
                  highlight={p.id === modelProvider}
                />
              ))}
            </div>
          </section>

          {/* Speech Provider */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Speech Provider</h3>
            <div className="flex gap-2 mb-3">
              {SPEECH_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSpeechChange(p.id)}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center justify-center gap-1.5 ${
                    speechProvider === p.id
                      ? "border-accent bg-accent text-white"
                      : "border-border hover:border-accent/30"
                  }`}
                >
                  {p.label}
                  {configuredProviders[p.id] && <CheckCircle size={12} />}
                </button>
              ))}
            </div>

            {/* Speech API Keys */}
            <div className="space-y-2">
              {SPEECH_PROVIDERS.map((p) => (
                <KeyRow
                  key={p.id}
                  provider={p}
                  configured={!!configuredProviders[p.id]}
                  draft={keyDrafts[p.id] || ""}
                  visible={!!keyVisible[p.id]}
                  saving={saving === p.id}
                  onDraftChange={(v) => setKeyDrafts((prev) => ({ ...prev, [p.id]: v }))}
                  onToggleVisible={() => setKeyVisible((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                  onSave={() => handleSaveKey(p.id)}
                  onRemove={() => handleRemoveKey(p.id)}
                  highlight={p.id === speechProvider}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function KeyRow({
  provider,
  configured,
  draft,
  visible,
  saving,
  onDraftChange,
  onToggleVisible,
  onSave,
  onRemove,
  highlight,
}: {
  provider: { id: string; label: string; placeholder: string };
  configured: boolean;
  draft: string;
  visible: boolean;
  saving: boolean;
  onDraftChange: (v: string) => void;
  onToggleVisible: () => void;
  onSave: () => void;
  onRemove: () => void;
  highlight: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
        highlight ? "border-accent/30 bg-accent-bg/30" : "border-border-light"
      }`}
    >
      <div className="w-24 shrink-0 flex items-center gap-1.5">
        {configured ? (
          <CheckCircle size={12} className="text-success shrink-0" />
        ) : (
          <div className="w-3 h-3 rounded-full border border-border shrink-0" />
        )}
        <span className="text-xs font-medium text-ink truncate">{provider.label}</span>
      </div>

      {configured && !draft ? (
        /* Key is set — show masked indicator + remove button */
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-ink-muted font-mono">••••••••••••</span>
          <div className="flex-1" />
          <button
            onClick={onRemove}
            disabled={saving}
            className="p-1 rounded hover:bg-paper-darker text-ink-muted hover:text-danger"
            title="Remove key"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      ) : (
        /* No key or editing — show input */
        <div className="flex-1 flex items-center gap-1.5">
          <div className="flex-1 relative">
            <input
              type={visible ? "text" : "password"}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              placeholder={provider.placeholder || `${provider.label} API key`}
              className="w-full text-xs bg-paper-dark border border-border rounded px-2 py-1 pr-7 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={onToggleVisible}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              {visible ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
          <button
            onClick={onSave}
            disabled={!draft.trim() || saving}
            className="p-1 rounded bg-accent text-white disabled:opacity-30 hover:bg-accent/90"
            title="Save key"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}
