import { ArrowLeft, ArrowRight, Copy, Trash2, Video } from "lucide-react";
import { clipThumbnail } from "./studio-timeline.jsx";

export function StudioClipInspector({
  film,
  selected,
  assets,
  canEdit,
  patch,
  move,
  duplicate,
  remove,
  auto,
}) {
  const index = film.clips.findIndex((clip, i) => (clip.id || i) === selected),
    clip = film.clips[index];
  if (!clip)
    return (
      <div className="cut-inspector-empty">
        <Video size={30} />
        <h3>Chaque plan a son histoire</h3>
        <p>
          Sélectionnez une vignette dans la timeline pour modifier sa légende,
          son cadrage ou sa durée.
        </p>
      </div>
    );
  const asset = assets.find((a) => a.id === clip.ref),
    thumbnail = clipThumbnail(clip);
  const maxSeconds =
    clip.kind === "video"
      ? Math.min(12, Math.max(1, (asset?.duration || 12) - clip.trim))
      : 12;
  const change = (body) => patch(index, body);
  return (
    <div className="cut-inspector form-stack">
      <div className="cut-inspector-title">
        {thumbnail ? (
          <img src={thumbnail} alt="Plan sélectionné" />
        ) : (
          <Video size={36} />
        )}
        <div>
          <span className="eyebrow">
            PLAN {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{clip.title || "Votre clip vidéo"}</h3>
          <small>
            {clip.kind === "video" ? "Extrait vidéo" : "Portrait photo"}
          </small>
        </div>
      </div>
      <div className="cut-inspector-actions">
        <button
          aria-label="Déplacer le plan à gauche"
          disabled={!canEdit || index === 0}
          onClick={() => move(index, index - 1)}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          aria-label="Déplacer le plan à droite"
          disabled={!canEdit || index === film.clips.length - 1}
          onClick={() => move(index, index + 1)}
        >
          <ArrowRight size={17} />
        </button>
        <button
          aria-label="Dupliquer le plan sélectionné"
          disabled={!canEdit || film.clips.length >= 100}
          onClick={() => duplicate(index)}
        >
          <Copy size={17} />
          <span>Dupliquer</span>
        </button>
        <button
          aria-label="Retirer le plan sélectionné"
          disabled={!canEdit}
          onClick={() => remove(index)}
        >
          <Trash2 size={17} />
        </button>
      </div>
      {clip.kind === "video" && (
        <label>
          Titre du plan
          <input
            value={clip.title}
            disabled={!canEdit}
            maxLength={100}
            onChange={(e) => change({ title: e.target.value })}
          />
        </label>
      )}
      <label>
        Légende
        <textarea
          value={clip.caption}
          disabled={!canEdit}
          maxLength={220}
          rows={3}
          placeholder="Un détail qui donne envie de le rencontrer…"
          onChange={(e) => change({ caption: e.target.value })}
        />
      </label>
      <div className="form-row">
        <label>
          {auto ? "Temps accordé au plan (s)" : "Durée du plan (s)"}
          <input
            type="number"
            min="1"
            max={maxSeconds}
            step={1 / 24}
            value={clip.seconds}
            disabled={!canEdit}
            onChange={(e) =>
              change({
                seconds: Math.min(maxSeconds, Math.max(1, +e.target.value)),
              })
            }
          />
        </label>
        <label>
          Cadrage
          <select
            value={clip.fit}
            disabled={!canEdit}
            onChange={(e) => change({ fit: e.target.value })}
          >
            <option value="cover">Remplir l’écran</option>
            <option value="contain">Photo entière</option>
          </select>
        </label>
      </div>
      {auto && (
        <p className="fineprint">
          La durée finale suit la voix. Ce réglage donne plus ou moins de place
          à ce plan.
        </p>
      )}
      {clip.kind === "video" && (
        <>
          <label>
            Point d’entrée dans la vidéo (s)
            <input
              type="number"
              min="0"
              max={Math.min(
                300,
                Math.max(0, (asset?.duration || 300) - clip.seconds),
              )}
              step="0.5"
              value={clip.trim}
              disabled={!canEdit}
              onChange={(e) =>
                change({
                  trim: Math.min(
                    300,
                    Math.max(
                      0,
                      Math.min(
                        (asset?.duration || 300) - clip.seconds,
                        +e.target.value,
                      ),
                    ),
                  ),
                })
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!clip.muted}
              disabled={!canEdit}
              onChange={(e) => change({ muted: !e.target.checked })}
            />
            Conserver le son du clip
          </label>
        </>
      )}
      {clip.fit === "cover" && (
        <details className="video-advanced">
          <summary>Garder le sujet dans le cadre</summary>
          {[
            ["focusX", "Cadrage horizontal"],
            ["focusY", "Cadrage vertical"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="range"
                min="0"
                max="100"
                value={clip[key] ?? 50}
                disabled={!canEdit}
                onChange={(e) => change({ [key]: +e.target.value })}
              />
            </label>
          ))}
        </details>
      )}
    </div>
  );
}
