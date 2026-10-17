import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Film,
  MessageSquare,
  BarChart3,
  Sparkles,
  Trash2,
  GripVertical,
  RotateCcw,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { api, uid } from "./api.js";
import { Button } from "./ui.jsx";
import { showTimeline, moveScene } from "../shared/signage.mjs";
const names = {
  animal: "Portrait",
  video: "Vidéo",
  message: "Message",
  stats: "Statistiques",
  logo: "Logo SPA",
  wallpaper: "Mosaïque",
  hours: "Horaires",
  spa: "Infos SPA",
};
export function ShowTimeline({ show, program: p, change, seek, notify }) {
  const [assets, setAssets] = useState([]),
    [selected, setSelected] = useState(null),
    [dragging, setDragging] = useState(null),
    [drop, setDrop] = useState(null),
    [resize, setResize] = useState(null),
    [expanded, setExpanded] = useState(false),
    sizing = useRef(null),
    moved = useRef(false);
  useEffect(() => {
    api("/video/assets")
      .then((v) => setAssets(v.filter((a) => a.kind === "video")))
      .catch(() => {});
  }, []);
  const blocks = p.inserts || [],
    timeline = show
      ? showTimeline({ ...show, program: p })
      : { scenes: [], frames: 0 };
  useEffect(() => {
    if (!expanded) return;
    const escape = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded]);
  const patch = (id, values) =>
    change({
      ...p,
      inserts: blocks.map((b) => (b.id === id ? { ...b, ...values } : b)),
    });
  const add = (type) => {
    const id = uid();
    change({
      ...p,
      inserts: [
        ...blocks,
        {
          id,
          type,
          afterAnimal: Math.min(show?.items.length || 0, p.maxAnimals),
          seconds: type === "video" ? 20 : 7,
          title: "",
          body: "",
          theme: "auto",
          ...(type === "video" && assets[0] ? { assetId: assets[0].id } : {}),
        },
      ],
    });
    setSelected(id);
  };
  const editor = (
    <section
      className={`panel programme-timeline ${expanded ? "is-expanded" : ""}`}
    >
      <div className="section-heading">
        <div>
          <h2>Timeline de diffusion</h2>
          <small>
            {Math.round(timeline.frames / 24)} s · lecture en boucle
          </small>
        </div>
        <Button
          type="button"
          variant="quiet"
          icon={expanded ? Minimize2 : Maximize2}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Réduire" : "Agrandir"}
        </Button>
      </div>
      <div className="programme-edit-hint">
        <GripVertical size={15} />
        <span>
          Glissez pour déplacer · étirez le bord droit pour régler la durée
        </span>
        <button
          type="button"
          onClick={() =>
            change({
              ...p,
              sceneOrder: [],
              sceneDurations: {},
              excludedScenes: [],
            })
          }
        >
          <RotateCcw size={13} />
          Réinitialiser la piste
        </button>
      </div>
      <div className="programme-track" aria-label="Ordre de lecture">
        {timeline.scenes.map((s, i) => {
          const seconds =
              resize?.key === s.key
                ? resize.seconds
                : Math.round(s.duration / 24),
            width = Math.max(100, seconds * 24),
            title = s.animal?.name || s.block?.title || names[s.type],
            max = Math.max(
              3,
              Math.ceil(
                Math.min(
                  120,
                  s.media?.kind === "video" ? s.media.duration || 120 : 120,
                ),
              ),
            );
          const duration = (value) => {
            const n = Math.max(3, Math.min(max, value));
            change({
              ...p,
              sceneDurations: { ...p.sceneDurations, [s.key]: n },
            });
          };
          const reorder = (target, after = false) => {
            change({
              ...p,
              sceneOrder: moveScene(
                timeline.scenes.map((x) => x.key),
                s.key,
                target,
                after,
              ),
            });
          };
          return (
            <article
              key={s.key}
              data-scene-key={s.key}
              style={{ width }}
              className={`programme-scene scene-${s.type} ${dragging === s.key ? "is-dragging" : ""} ${drop?.key === s.key ? `drop-${drop.after ? "after" : "before"}` : ""}`}
              draggable={!resize}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", s.key);
                setDragging(s.key);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDrop(null);
              }}
              onDragOver={(e) => {
                if (!dragging || dragging === s.key) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const r = e.currentTarget.getBoundingClientRect();
                setDrop({
                  key: s.key,
                  after: e.clientX > r.left + r.width / 2,
                });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) {
                  change({
                    ...p,
                    sceneOrder: moveScene(
                      timeline.scenes.map((x) => x.key),
                      dragging,
                      s.key,
                      !!drop?.after,
                    ),
                  });
                }
                setDragging(null);
                setDrop(null);
              }}
            >
              <button
                className="programme-scene-main"
                type="button"
                aria-label={`${title}, ${seconds} secondes. Déplacer avec Alt et les flèches.`}
                onKeyDown={(e) => {
                  if (e.altKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const target =
                      timeline.scenes[i + (e.key === "ArrowLeft" ? -1 : 1)];
                    if (target) reorder(target.key, e.key === "ArrowRight");
                  }
                }}
                onClick={() => {
                  if (moved.current) {
                    moved.current = false;
                    return;
                  }
                  seek?.(s.start + Math.min(24, s.duration / 2));
                  if (s.block) setSelected(s.block.id);
                }}
              >
                <span className="programme-scene-time">
                  {Math.floor(s.start / 24 / 60)}:
                  {String(Math.floor(s.start / 24) % 60).padStart(2, "0")}
                  <GripVertical size={12} />
                </span>
                {s.media?.kind === "video" ? (
                  <video
                    src={s.media.src}
                    poster={s.animal?.photo || undefined}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedMetadata={(e) => {
                      if (e.currentTarget.duration > 1)
                        e.currentTarget.currentTime = Math.min(
                          2,
                          e.currentTarget.duration * 0.35,
                        );
                    }}
                  />
                ) : s.animal?.photo ? (
                  <img src={s.animal.photo} alt="" draggable={false} />
                ) : (
                  <span className="programme-scene-icon">
                    {s.type === "video" ? (
                      <Film size={22} />
                    ) : s.type === "message" ? (
                      <MessageSquare size={22} />
                    ) : s.type === "stats" ? (
                      <BarChart3 size={22} />
                    ) : (
                      <Sparkles size={22} />
                    )}
                  </span>
                )}
                <strong>{title}</strong>
                <small>{seconds} s</small>
              </button>
              <button
                type="button"
                className="programme-remove"
                aria-label={`Retirer ${title} de la timeline`}
                onClick={() =>
                  change({
                    ...p,
                    excludedScenes: [...(p.excludedScenes || []), s.key],
                  })
                }
              >
                <Trash2 size={12} />
              </button>
              <button
                type="button"
                className="programme-resize"
                role="slider"
                aria-label={`Durée de ${title}`}
                aria-valuemin={3}
                aria-valuemax={max}
                aria-valuenow={seconds}
                title="Étirer pour changer la durée"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  moved.current = true;
                  sizing.current = {
                    key: s.key,
                    x: e.clientX,
                    start: seconds,
                    seconds,
                  };
                  setResize({ key: s.key, seconds });
                }}
                onPointerMove={(e) => {
                  const r = sizing.current;
                  if (r?.key !== s.key) return;
                  const n = Math.max(
                    3,
                    Math.min(max, Math.round(r.start + (e.clientX - r.x) / 24)),
                  );
                  r.seconds = n;
                  setResize({ key: s.key, seconds: n });
                }}
                onPointerUp={(e) => {
                  if (sizing.current?.key !== s.key) return;
                  duration(sizing.current.seconds);
                  sizing.current = null;
                  setResize(null);
                }}
                onPointerCancel={() => {
                  sizing.current = null;
                  setResize(null);
                }}
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowLeft",
                      "ArrowDown",
                      "ArrowRight",
                      "ArrowUp",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    duration(
                      seconds +
                        (["ArrowLeft", "ArrowDown"].includes(e.key) ? -1 : 1),
                    );
                  }
                }}
              >
                <span />
              </button>
            </article>
          );
        })}
      </div>
      <div className="feature-actions">
        {[
          ["message", MessageSquare, "Message à thème"],
          ["video", Film, "Vidéo"],
          ["stats", BarChart3, "Statistiques"],
          ["logo", Sparkles, "Logo"],
          ["hours", MessageSquare, "Horaires"],
          ["spa", MessageSquare, "Infos SPA"],
        ].map(([type, Icon, label]) => (
          <Button
            key={type}
            type="button"
            variant="secondary"
            icon={Icon}
            disabled={
              blocks.length >= 40 || (type === "stats" && !p.statsEnabled)
            }
            onClick={() => add(type)}
          >
            Insérer {label.toLowerCase()}
          </Button>
        ))}
      </div>
      {blocks.length > 0 && (
        <div className="programme-blocks">
          {blocks.map((b) => (
            <details
              key={b.id}
              open={b.id === selected}
              onToggle={(e) => {
                if (e.currentTarget.open) setSelected(b.id);
              }}
            >
              <summary>
                {names[b.type]} · {b.title || `${b.seconds} s`}
                <span>
                  {b.afterAnimal === 0
                    ? "Avant les animaux"
                    : `Après ${Math.min(b.afterAnimal, show?.items.length || 0)} animal(aux)`}
                </span>
              </summary>
              <div className="form-two">
                <label>
                  Emplacement
                  <select
                    value={Math.min(b.afterAnimal, show?.items.length || 0)}
                    onChange={(e) =>
                      change({
                        ...p,
                        inserts: blocks.map((x) =>
                          x.id === b.id
                            ? { ...x, afterAnimal: Number(e.target.value) }
                            : x,
                        ),
                        sceneOrder: [],
                      })
                    }
                  >
                    <option value="0">Avant le premier animal</option>
                    {(show?.items || []).map((a, i) => (
                      <option key={a.id} value={i + 1}>
                        Après {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Durée (secondes)
                  <input
                    type="number"
                    min="3"
                    max="120"
                    value={p.sceneDurations?.[`insert:${b.id}`] || b.seconds}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 3 && n <= 120)
                        change({
                          ...p,
                          inserts: blocks.map((x) =>
                            x.id === b.id ? { ...x, seconds: n } : x,
                          ),
                          sceneDurations: {
                            ...p.sceneDurations,
                            [`insert:${b.id}`]: n,
                          },
                        });
                    }}
                  />
                </label>
                <label>
                  Titre
                  <input
                    value={b.title}
                    maxLength="100"
                    onChange={(e) => patch(b.id, { title: e.target.value })}
                  />
                </label>
                {b.type === "video" && (
                  <label>
                    Vidéo du studio
                    <select
                      value={b.assetId || ""}
                      onChange={(e) => patch(b.id, { assetId: e.target.value })}
                    >
                      <option value="">Choisir une vidéo…</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.filename}
                        </option>
                      ))}
                    </select>
                    <small>
                      Ce média sera accessible via le lien TV après
                      enregistrement.
                    </small>
                  </label>
                )}
                {["message", "hours", "spa"].includes(b.type) && (
                  <>
                    <label>
                      Thème
                      <select
                        value={b.theme}
                        onChange={(e) => patch(b.id, { theme: e.target.value })}
                      >
                        {[
                          ["auto", "Automatique · selon la date"],
                          ["classic", "Classique"],
                          ["easter", "Pâques"],
                          ["halloween", "Halloween"],
                          ["christmas", "Noël"],
                          ["summer", "Été"],
                        ].map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="full-width">
                      {b.type === "hours"
                        ? "Horaires · un jour ou groupe de jours par ligne"
                        : "Message"}
                      <textarea
                        placeholder={
                          b.type === "hours"
                            ? "Lundi : fermé\nMardi à dimanche : 14h – 17h"
                            : undefined
                        }
                        value={b.body}
                        maxLength="350"
                        rows="3"
                        onChange={(e) => patch(b.id, { body: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="quiet"
                icon={Trash2}
                onClick={() =>
                  change({ ...p, inserts: blocks.filter((x) => x.id !== b.id) })
                }
              >
                Retirer la séquence
              </Button>
            </details>
          ))}
        </div>
      )}
      {!assets.length && (
        <small>
          Pour insérer un clip, importez-le dans les médias du studio vidéo.
        </small>
      )}
    </section>
  );
  return expanded ? createPortal(editor, document.body) : editor;
}
