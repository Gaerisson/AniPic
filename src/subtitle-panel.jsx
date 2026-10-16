import { useState, useRef } from "react";
import {
  Captions,
  Download,
  Upload,
  Plus,
  Trash2,
  AudioLines,
  TextCursorInput,
} from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
import {
  estimatedCues,
  toSrt,
  parseSrt,
  validateCues,
} from "../shared/subtitles.mjs";
const empty = {
  enabled: false,
  style: "box",
  position: "bottom",
  source: "manual",
  cues: [],
};
export function SubtitlePanel({
  film,
  assets,
  canEdit,
  notify,
  update,
  duration,
}) {
  const cfg = film.subtitles || empty,
    [assetId, setAssetId] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef();
  const patch = (k, v) => update("subtitles", { ...cfg, [k]: v });
  function replace(cues, source) {
    try {
      validateCues(cues, duration);
      update("subtitles", { ...cfg, enabled: true, cues, source });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function download() {
    try {
      const url = URL.createObjectURL(
          new Blob([toSrt(validateCues(cfg.cues, duration))], {
            type: "application/x-subrip;charset=utf-8",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "sous-titres.srt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <details className="feature-details subtitle-panel">
      <summary>
        <Captions size={21} />
        <strong>Sous-titres</strong>
        <span>
          {cfg.cues.length
            ? `${cfg.cues.length} segments`
            : "Créer ou importer"}
        </span>
      </summary>
      <div className="feature-body">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={cfg.enabled}
            disabled={!canEdit}
            onChange={(e) => patch("enabled", e.target.checked)}
          />
          Incruster les sous-titres dans la vidéo
        </label>
        <div className="feature-actions">
          <Button
            variant="secondary"
            icon={TextCursorInput}
            disabled={!canEdit || !film.narrationText?.trim()}
            onClick={() => {
              const start = film.voiceover?.start || 0,
                a = assets.find((a) => a.id === film.voiceover?.assetId),
                seconds = Math.min(
                  a?.duration ||
                    Math.max(
                      1,
                      film.narrationText.trim().split(/\s+/).length / 2.5,
                    ),
                  duration - start,
                );
              replace(
                estimatedCues(film.narrationText, start, seconds),
                "estimated",
              );
            }}
          >
            Depuis le texte de voix off
          </Button>
          <Button
            variant="secondary"
            icon={Upload}
            disabled={!canEdit}
            onClick={() => input.current?.click()}
          >
            Importer SRT
          </Button>
          <Button
            variant="secondary"
            icon={Download}
            disabled={!cfg.cues.length}
            onClick={download}
          >
            Exporter SRT
          </Button>
          <input
            hidden
            type="file"
            accept=".srt"
            ref={input}
            onChange={async (e) => {
              const f = e.target.files[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 200000) {
                setError("SRT limité à 200 Ko.");
                return;
              }
              try {
                replace(parseSrt(await f.text()), "srt");
              } catch (err) {
                setError(err.message);
              }
            }}
          />
        </div>
        {cfg.source === "estimated" && (
          <p className="fineprint">
            Minutage estimé d’après le texte. Écoutez le film et ajustez les
            temps avant l’export.
          </p>
        )}
        <details className="subtitle-transcribe">
          <summary>Transcription automatique · Mistral</summary>
          <label>
            Piste à transcrire
            <select
              value={assetId || film.voiceover?.assetId || ""}
              disabled={!canEdit || busy}
              onChange={(e) => setAssetId(e.target.value)}
            >
              <option value="">Choisir un son ou un clip</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Envoyer cette piste au service Mistral configuré
          </label>
          <Button
            icon={AudioLines}
            disabled={
              !canEdit ||
              busy ||
              !confirm ||
              !(assetId || film.voiceover?.assetId)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api("/video/transcribe", {
                  method: "POST",
                  body: {
                    assetId: assetId || film.voiceover.assetId,
                    offset:
                      (assetId || film.voiceover?.assetId) ===
                      film.voiceover?.assetId
                        ? film.voiceover.start
                        : 0,
                    confirmUpload: true,
                  },
                });
                replace(r.cues, "mistral");
                notify("Transcription reçue. Relisez les noms des animaux.");
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Transcription…" : "Transcrire la piste"}
          </Button>
          <small>
            MISTRAL_API_KEY requis. Les temps d’un clip sont relatifs au fichier
            source ; ajustez-les si le clip est découpé.
          </small>
        </details>
        <div className="workbench-form-grid">
          <label>
            Style
            <select
              value={cfg.style}
              disabled={!canEdit}
              onChange={(e) => patch("style", e.target.value)}
            >
              <option value="box">Cartouche sombre</option>
              <option value="shadow">Texte et ombre</option>
            </select>
          </label>
          <label>
            Position
            <select
              value={cfg.position}
              disabled={!canEdit}
              onChange={(e) => patch("position", e.target.value)}
            >
              <option value="bottom">Bas · zone sûre</option>
              <option value="middle">Milieu</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="subtitle-cues">
          {cfg.cues.map((c, i) => (
            <div key={i}>
              <label>
                Début (s)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={duration}
                  value={c.start}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patch(
                      "cues",
                      cfg.cues.map((s, j) =>
                        j === i ? { ...s, start: Number(e.target.value) } : s,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Fin (s)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={duration}
                  value={c.end}
                  disabled={!canEdit}
                  onChange={(e) =>
                    patch(
                      "cues",
                      cfg.cues.map((s, j) =>
                        j === i ? { ...s, end: Number(e.target.value) } : s,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Texte
                <textarea
                  rows={2}
                  maxLength={300}
                  disabled={!canEdit}
                  value={c.text}
                  onChange={(e) =>
                    patch(
                      "cues",
                      cfg.cues.map((s, j) =>
                        j === i ? { ...s, text: e.target.value } : s,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="icon-button"
                aria-label={`Retirer le sous-titre ${i + 1}`}
                disabled={!canEdit}
                onClick={() =>
                  patch(
                    "cues",
                    cfg.cues.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button
          icon={Plus}
          variant="secondary"
          disabled={
            !canEdit ||
            cfg.cues.length >= 500 ||
            (cfg.cues.at(-1)?.end || 0) >= duration
          }
          onClick={() => {
            const start = cfg.cues.at(-1)?.end || 0;
            patch("cues", [
              ...cfg.cues,
              {
                start,
                end: Math.min(start + 3, duration),
                text: "Nouveau sous-titre",
              },
            ]);
          }}
        >
          Ajouter un sous-titre
        </Button>
      </div>
    </details>
  );
}
