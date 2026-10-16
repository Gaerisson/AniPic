import { useState, useEffect } from "react";
import {
  Mic,
  Play,
  Plus,
  RefreshCw,
  FileText,
  Square,
  ChevronDown,
  Volume2,
} from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function VoicePanel({
  film,
  canEdit,
  notify,
  onAdd,
  onTextChange,
  initialOpen = false,
}) {
  const [status, setStatus] = useState(null),
    [voices, setVoices] = useState([]),
    [voice, setVoice] = useState(""),
    [provider, setProvider] = useState("local"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [audio, setAudio] = useState(null),
    [expanded, setExpanded] = useState(initialOpen),
    [speaking, setSpeaking] = useState(false);
  const text = film.narrationText || "",
    setText = (value) => onTextChange?.(value);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  useEffect(() => {
    if (initialOpen) setExpanded(true);
  }, [initialOpen]);
  useEffect(() => {
    api("/team-ai/status")
      .then((s) => {
        setStatus(s);
        setVoice(s.defaultVoice);
      })
      .catch((e) => setError(e.message));
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);
  async function draft() {
    setBusy("draft");
    setError("");
    try {
      const r = await api("/video/narration/draft", {
        method: "POST",
        body: {
          photoIds: [
            ...new Set(
              film.clips.filter((c) => c.kind === "photo").map((c) => c.ref),
            ),
          ].slice(0, 12),
          provider,
        },
      });
      setText(r.text);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function list() {
    setBusy("voices");
    setError("");
    try {
      const r = await api("/video/voices");
      setVoices(r.items);
      if (!voice && r.items[0]) setVoice(r.items[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function generate() {
    setBusy("generate");
    setError("");
    try {
      const result = await api("/video/narration/generate", {
        method: "POST",
        body: { text, voiceId: voice, title: film.title.slice(0, 60) },
      });
      setAudio(result);
      notify(
        result.cached
          ? "Voix déjà générée, récupérée sans nouvel appel."
          : "Voix off générée. Écoutez-la avant de l’ajouter.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <details
      className="voice-panel video-advanced"
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>
        <span className="voice-summary-icon">
          <Mic size={20} />
        </span>
        <span className="voice-summary-title">
          <strong>Voix off</strong>
          <small>Texte, voix et mixage</small>
        </span>
        <span className="voice-summary-action">
          {expanded ? "Réduire" : "Configurer"}
          <ChevronDown size={16} />
        </span>
      </summary>
      <div className="voice-controls">
        <section className="voice-step">
          <h3>
            <span>1</span> Préparer la narration
          </h3>
          <div className="voice-provider-row">
            <select
              aria-label="Service de rédaction de voix off"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="local">Brouillon depuis la SPA</option>
              {status?.gemini && <option value="gemini">Gemini</option>}
              {status?.tokenharbor && (
                <option value="tokenharbor">Token Harbor</option>
              )}
            </select>
            <Button
              type="button"
              variant="secondary"
              icon={FileText}
              disabled={
                !canEdit ||
                !!busy ||
                !film.clips.some((c) => c.kind === "photo")
              }
              onClick={draft}
            >
              Préparer le texte
            </Button>
          </div>
          <label>
            Texte de la narration
            <textarea
              rows={6}
              maxLength={2000}
              value={text}
              disabled={!canEdit || !!busy}
              onChange={(e) => setText(e.target.value)}
              placeholder="Préparez un brouillon à partir des photos du montage, ou écrivez votre texte."
            />
          </label>
          <small>
            {words} / 300 mots · environ {Math.ceil(words / 2.5)} secondes
          </small>
        </section>
        <section className="voice-step">
          <h3>
            <span>2</span> Choisir et écouter une voix
          </h3>
          <div className="voice-choice-actions">
            <Button
              type="button"
              variant="secondary"
              icon={RefreshCw}
              disabled={!canEdit || !!busy || !status?.mistral}
              onClick={list}
            >
              Voix françaises Mistral
            </Button>
            {typeof speechSynthesis !== "undefined" && (
              <Button
                type="button"
                variant="quiet"
                icon={speaking ? Square : Volume2}
                disabled={!text}
                onClick={() => {
                  speechSynthesis.cancel();
                  if (speaking) {
                    setSpeaking(false);
                    return;
                  }
                  const utterance = new SpeechSynthesisUtterance(text);
                  utterance.lang = "fr-FR";
                  const french =
                    speechSynthesis
                      .getVoices()
                      .find((v) => v.lang === "fr-FR" && v.localService) ||
                    speechSynthesis
                      .getVoices()
                      .find((v) => v.lang.startsWith("fr"));
                  if (french) utterance.voice = french;
                  utterance.onend = () => setSpeaking(false);
                  utterance.onerror = () => setSpeaking(false);
                  setSpeaking(true);
                  speechSynthesis.speak(utterance);
                }}
              >
                {speaking
                  ? "Arrêter l’aperçu"
                  : "Écouter le texte sur cet appareil"}
              </Button>
            )}
          </div>
          {voices.length > 0 ? (
            <select
              aria-label="Voix Mistral"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              {voices.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : (
            <label>
              Identifiant de voix Mistral
              <input
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="Choisir dans le catalogue ou saisir un voice_id"
                maxLength={100}
              />
            </label>
          )}
          {!status?.mistral && (
            <p className="fineprint">
              Mistral n’est pas encore connecté. Un administrateur peut le
              configurer dans API & connexions. L’aperçu de cet appareil n’est
              pas exporté.
            </p>
          )}
        </section>
        <section className="voice-step">
          <h3>
            <span>3</span> Générer la piste audio
          </h3>
          <Button
            type="button"
            icon={Mic}
            disabled={
              !canEdit ||
              !!busy ||
              !status?.mistral ||
              !text.trim() ||
              !voice ||
              words > 300
            }
            onClick={generate}
          >
            {busy === "generate"
              ? "Génération…"
              : "Générer la voix avec Mistral"}
          </Button>
          <p className="fineprint">
            Ce bouton envoie le texte à Mistral via votre compte API.
          </p>
          {words > 300 && (
            <p className="error-text">
              Raccourcissez le texte à 300 mots maximum.
            </p>
          )}
          {audio && (
            <div className="voice-result">
              <audio controls src={`/api/video/assets/${audio.id}/file`} />
              <Button type="button" icon={Plus} onClick={() => onAdd(audio)}>
                Ajouter au montage
              </Button>
              <a
                className="text-link"
                href={`/api/video/assets/${audio.id}/file`}
                download="voix-off.mp3"
              >
                Télécharger la voix
              </a>
            </div>
          )}
        </section>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
