import { useEffect, useState } from "react";
import { Mic, Save } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function AudioSettings({ notify }) {
  const [v, setV] = useState(null),
    [key, setKey] = useState(""),
    [remove, setRemove] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/audio")
      .then(setV)
      .catch((e) => setError(e.message));
  }, []);
  const patch = (k, x) => setV({ ...v, [k]: x });
  return (
    <section className="panel audio-config">
      <h2>
        <Mic size={20} /> Audio · Mistral
      </h2>
      {error && <p role="alert">{error}</p>}
      {v && (
        <>
          <div className="connection-status">
            <strong>
              {v.configured ? "Connecté · clé présente" : "À connecter"}
            </strong>
            <span>
              {v.source === "environment"
                ? "Variable d’environnement prioritaire"
                : "Réglages du serveur"}
            </span>
          </div>
          <label>
            Clé API Mistral
            <input
              type="password"
              autoComplete="new-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                v.configured
                  ? "Laisser vide pour conserver la clé"
                  : "Coller la clé API"
              }
              maxLength="500"
            />
          </label>
          <div className="form-two">
            {[
              ["ttsModel", "Modèle de voix off"],
              ["sttModel", "Modèle de transcription"],
              ["voiceId", "Voix par défaut (voice_id)"],
            ].map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  value={v[k] || ""}
                  onChange={(e) => patch(k, e.target.value)}
                  maxLength="100"
                />
              </label>
            ))}
          </div>
          {v.source === "interface" && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={remove}
                onChange={(e) => setRemove(e.target.checked)}
              />
              Retirer la clé enregistrée
            </label>
          )}
          <Button
            type="button"
            icon={Save}
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const next = await api("/admin/audio", {
                  method: "PUT",
                  body: {
                    apiKey: key || undefined,
                    removeKey: remove,
                    ttsModel: v.ttsModel,
                    sttModel: v.sttModel,
                    voiceId: v.voiceId,
                  },
                });
                setV(next);
                setKey("");
                setRemove(false);
                notify("Configuration Mistral enregistrée.");
                setError("");
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer Mistral
          </Button>
          <small>
            La clé reste sur le serveur. Enregistrer les réglages ne lance aucun
            appel payant.
          </small>
        </>
      )}
    </section>
  );
}
