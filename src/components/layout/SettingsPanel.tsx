import { useEffect, useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { checkHealth, getSettings, updateSettings } from "../../api/client";
import { X, CheckCircle, XCircle } from "lucide-react";

export function SettingsPanel() {
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const speechProvider = useUIStore((s) => s.speechProvider);
  const setSpeechProvider = useUIStore((s) => s.setSpeechProvider);
  const llmModel = useUIStore((s) => s.llmModel);
  const setLlmModel = useUIStore((s) => s.setLlmModel);

  const [health, setHealth] = useState<any>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setHealth(h);
        setBackendAvailable(true);
      })
      .catch(() => setBackendAvailable(false));

    getSettings()
      .then((s) => {
        setAvailableModels(s.available_models);
        setSpeechProvider(s.speech_provider);
        setLlmModel(s.llm_model);
      })
      .catch(() => {});
  }, []);

  const handleModelChange = async (model: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="bg-paper rounded-2xl border border-border shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Settings</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-paper-darker text-ink-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Backend status */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Backend Status</h3>
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
                  <span className="text-danger">Not available — start backend with: python3 backend/main.py</span>
                </>
              )}
            </div>

            {health && (
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-muted">
                <span>Deepgram:</span>
                <span className={health.has_deepgram_key ? "text-success" : "text-danger"}>
                  {health.has_deepgram_key ? "Key set" : "Missing"}
                </span>
                <span>AssemblyAI:</span>
                <span className={health.has_assemblyai_key ? "text-success" : "text-danger"}>
                  {health.has_assemblyai_key ? "Key set" : "Missing"}
                </span>
                <span>Cerebras:</span>
                <span className={health.has_cerebras_key ? "text-success" : "text-danger"}>
                  {health.has_cerebras_key ? "Key set" : "Missing"}
                </span>
                <span>Anthropic:</span>
                <span className={health.has_anthropic_url ? "text-success" : "text-danger"}>
                  {health.has_anthropic_url ? "URL set" : "Missing"}
                </span>
              </div>
            )}
          </section>

          {/* LLM Model */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">LLM Model</h3>
            <select
              value={llmModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full text-sm bg-paper-dark border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {(availableModels.length > 0 ? availableModels : [llmModel]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <p className="text-xs text-ink-muted mt-1">
              Used for entity extraction and warm start suggestions. Any LiteLLM-compatible model string works.
            </p>
          </section>

          {/* Speech Provider */}
          <section>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Speech Provider</h3>
            <div className="flex gap-2">
              {["deepgram", "assemblyai"].map((p) => (
                <button
                  key={p}
                  onClick={() => handleSpeechChange(p)}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    speechProvider === p
                      ? "border-accent bg-accent text-white"
                      : "border-border hover:border-accent/30"
                  }`}
                >
                  {p === "deepgram" ? "Deepgram" : "AssemblyAI"}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted mt-1">
              Used for audio transcription when you record via the mic button.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
