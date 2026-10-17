import {
  posterLayoutDefaults,
  textDefaults,
} from "../shared/content-defaults.mjs";
import { useState, useEffect, useRef } from "react";
import { Download, Printer, Package, Copy, CheckCircle2 } from "lucide-react";
import { api, apiBlob, apiDownload, imageUrl, copyText, date } from "./api.js";
import { Button, Modal, Spinner } from "./ui.jsx";
export function AnimalCommunication({
  animal,
  photo,
  selected,
  open,
  notify,
  reload,
  canEdit,
  onUpdate,
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="animal-communication">
      {canEdit && (
        <label className="publication-check">
          <input
            type="checkbox"
            disabled={busy}
            checked={!!animal.publication}
            onChange={async (e) => {
              const published = e.target.checked;
              setBusy(true);
              try {
                await api(`/animals/${animal.id}/publication`, {
                  method: "PUT",
                  body: { published },
                });
                onUpdate?.();
                reload();
              } catch (err) {
                notify(err.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          />
          <CheckCircle2 size={17} />
          <span>
            Publié
            {animal.publication && (
              <small>
                Mis en avant le {date(animal.publication.published_at)}
              </small>
            )}
          </span>
        </label>
      )}
      {(photo || animal.source_metadata?.thumbnail) && (
        <Button
          icon={Printer}
          variant="secondary"
          onClick={() =>
            open({
              type: "communication",
              animalId: animal.id,
              photoId: photo?.id || "spa",
              photoIds: selected?.length ? selected : [photo?.id || "spa"],
            })
          }
        >
          Créer l’affiche de box
        </Button>
      )}
      {canEdit && (
        <button
          className="text-link"
          onClick={async () => {
            const name =
              animal.name.replace(/[\\/:*?"<>|]/g, "_") +
              "__" +
              (animal.source_id || animal.id).split(":").at(-1);
            try {
              await copyText(name);
              notify("Nom de dossier copié : " + name);
            } catch {
              notify(name);
            }
          }}
        >
          <Copy size={14} />
          Nom de dossier pour Lightroom
        </button>
      )}
    </div>
  );
}
export function CommunicationDialog({
  animalId,
  photoId,
  photoIds,
  close,
  notify,
  overview,
  canEdit,
  user,
}) {
  const [animal, setAnimal] = useState(null),
    [chosen, setChosen] = useState(photoId),
    [selected, setSelected] = useState(photoIds || []),
    [opts, setOpts] = useState({
      texts: { ...textDefaults, ...overview?.interface.textDefaults },
      customLayout: {
        ...posterLayoutDefaults,
        ...overview?.interface.posterLayout,
      },
      accent: overview?.interface.accentColor || "#eb783c",
      paper: "a4",
      template: "spa",
      showCompatibility: true,
      showQr: true,
      focusX: 50,
      focusY: 50,
    }),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const current = useRef("");
  useEffect(() => {
    api(`/animals/${animalId}`)
      .then((a) => {
        setAnimal(a);
        if (!chosen)
          setChosen(
            a.photos[0]?.id || (a.source_metadata?.thumbnail ? "spa" : ""),
          );
      })
      .catch((e) => setError(e.message));
    return () => URL.revokeObjectURL(current.current);
  }, [animalId]);
  useEffect(() => {
    if (!chosen) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const blob = await apiBlob(`/animals/${animalId}/poster`, {
          ...opts,
          photoId: chosen,
          format: "preview",
        });
        if (!alive) return;
        URL.revokeObjectURL(current.current);
        current.current = URL.createObjectURL(blob);
        setPreview(current.current);
        setError("");
      } catch (e) {
        if (alive) setError(e.message);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [chosen, opts, animalId]);
  async function download(kind) {
    setBusy(kind);
    try {
      if (kind === "pack")
        await apiDownload(
          `/animals/${animalId}/communication-pack`,
          {
            photoIds: [chosen, ...selected.filter((p) => p !== chosen)].slice(
              0,
              8,
            ),
            accent: opts.accent,
            includePoster: true,
            template: opts.template,
          },
          `${animal.name}-communication.zip`,
        );
      else
        await apiDownload(
          `/animals/${animalId}/poster`,
          { ...opts, photoId: chosen, format: kind },
          `${animal.name}-affiche-${opts.paper}.${kind}`,
        );
      notify("Export prêt.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy("");
    }
  }
  const patch = (key, value) => setOpts((v) => ({ ...v, [key]: value }));
  return (
    <Modal
      title={`Affiche de box${animal ? " · " + animal.name : ""}`}
      onClose={() => !busy && close()}
      wide
      className="communication-modal"
    >
      <div className="communication-grid">
        <div className="poster-preview">
          {preview ? (
            <div className="poster-edit-canvas">
              <img src={preview} alt="Aperçu de l’affiche portrait" />
              {opts.template === "custom" &&
                Object.entries(opts.customLayout).map(([key, slot]) => (
                  <button
                    key={key}
                    className="poster-drag-slot"
                    style={{ left: slot.x + "%", top: slot.y + "%" }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!e.currentTarget.hasPointerCapture(e.pointerId))
                        return;
                      const r =
                        e.currentTarget.parentElement.getBoundingClientRect();
                      patch("customLayout", {
                        ...opts.customLayout,
                        [key]: {
                          ...slot,
                          x: Math.max(
                            0,
                            Math.min(
                              90,
                              ((e.clientX - r.left) / r.width) * 100,
                            ),
                          ),
                          y: Math.max(
                            5,
                            Math.min(
                              94,
                              ((e.clientY - r.top) / r.height) * 100,
                            ),
                          ),
                        },
                      });
                    }}
                    onPointerUp={(e) =>
                      e.currentTarget.releasePointerCapture(e.pointerId)
                    }
                  >
                    {
                      {
                        name: "Nom",
                        facts: "Informations",
                        description: "Présentation",
                        cta: "Invitation",
                      }[key]
                    }{" "}
                    ↔
                  </button>
                ))}
            </div>
          ) : (
            <Spinner />
          )}
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="communication-settings">
          <span className="eyebrow">AFFICHE PORTRAIT</span>
          <h2>Affiche de box</h2>
          <small>
            Le QR ouvre la fiche SPA, ou la page du refuge si son lien
            individuel est absent.
          </small>
          <div className="feature-actions">
            <Button
              icon={Printer}
              disabled={!!busy || !preview}
              onClick={() => download("pdf")}
            >
              {busy === "pdf" ? "Préparation…" : "PDF imprimable"}
            </Button>
            <Button
              variant="secondary"
              icon={Download}
              disabled={!!busy || !preview}
              onClick={() => download("png")}
            >
              PNG 300 dpi
            </Button>
          </div>
          <p className="muted">Logo et palette SPA · A4 portrait par défaut.</p>
          <div className="poster-template-picks">
            {[
              ["spa", "SPA · Institutionnel"],
              ["editorial", "Éditorial"],
              ["glass", "Liquid glass"],
              ["contrast", "Contraste"],
              ["custom", "Personnalisé · placement libre"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={opts.template === id ? "active" : ""}
                onClick={() => patch("template", id)}
              >
                {label}
              </button>
            ))}
          </div>
          <details className="feature-details">
            <summary>Textes de l’affiche</summary>
            {["posterTitle", "invitation", "posterFooter"].map((key) => (
              <label key={key}>
                {
                  {
                    posterTitle: "Titre",
                    invitation: "Invitation",
                    posterFooter: "Pied de page",
                  }[key]
                }
                <input
                  value={opts.texts[key]}
                  maxLength={500}
                  onChange={(e) =>
                    patch("texts", { ...opts.texts, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </details>
          {opts.template === "custom" && (
            <details className="feature-details" open>
              <summary>Éditeur de placement</summary>
              <small>
                Glissez les repères sur l’aperçu. Les informations de l’animal
                proviennent toujours de la SPA.
              </small>
              {Object.entries(opts.customLayout).map(([key, slot]) => (
                <label key={key}>
                  Taille · {key}
                  <input
                    type="range"
                    min="14"
                    max="90"
                    value={slot.size}
                    onChange={(e) =>
                      patch("customLayout", {
                        ...opts.customLayout,
                        [key]: { ...slot, size: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
              <Button
                variant="quiet"
                onClick={() => patch("customLayout", posterLayoutDefaults)}
              >
                Réinitialiser le placement
              </Button>
              {user?.role === "admin" && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api("/admin/settings", {
                        method: "PUT",
                        body: { posterLayout: opts.customLayout },
                      });
                      notify("Placement enregistré comme modèle personnalisé.");
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                >
                  Mémoriser ce modèle · admin
                </Button>
              )}
            </details>
          )}
          <label>
            Format papier
            <select
              value={opts.paper}
              onChange={(e) => patch("paper", e.target.value)}
            >
              <option value="a4">A4 portrait · 210 × 297 mm</option>
              <option value="a5">A5 portrait · 148 × 210 mm</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={opts.showCompatibility}
              onChange={(e) => patch("showCompatibility", e.target.checked)}
            />
            Afficher les ententes renseignées
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={opts.showQr}
              onChange={(e) => patch("showQr", e.target.checked)}
            />
            QR vers la fiche SPA / le refuge
          </label>
          <small>
            Le QR ouvre la page du refuge quand aucun lien individuel SPA n’est
            renseigné.
          </small>
          <label>
            Cadrage horizontal
            <select
              value={opts.focusX}
              onChange={(e) => patch("focusX", Number(e.target.value))}
            >
              <option value={0}>Gauche</option>
              <option value={50}>Auto · sujet</option>
              <option value={100}>Droite</option>
            </select>
          </label>
          <label>
            Cadrage vertical
            <select
              value={opts.focusY}
              onChange={(e) => patch("focusY", Number(e.target.value))}
            >
              <option value={0}>Haut</option>
              <option value={50}>Auto · sujet</option>
              <option value={100}>Bas</option>
            </select>
          </label>
          <div className="communication-photos">
            {animal?.source_metadata?.thumbnail && (
              <button
                className={chosen === "spa" ? "selected" : ""}
                onClick={() => setChosen("spa")}
                aria-label="Utiliser la photo du site SPA sur l’affiche"
              >
                <img
                  src={`/api/animals/${animal.id}/source-photo?w=320`}
                  alt="Photo du site SPA"
                />
                <small>SPA</small>
              </button>
            )}
            {animal?.photos
              .filter((p) => !p.archived_at)
              .map((p) => (
                <button
                  key={p.id}
                  className={chosen === p.id ? "selected" : ""}
                  onClick={() => setChosen(p.id)}
                  aria-label={`Utiliser ${p.filename} sur l’affiche`}
                >
                  <img src={imageUrl(p.id, 320)} alt="" />
                </button>
              ))}
          </div>
          {canEdit && (
            <details className="feature-details">
              <summary>
                <Package size={17} />
                <strong>Pack communication</strong>
              </summary>
              <div className="feature-body">
                <p>
                  Photos web, visuels Facebook et story, présentation et affiche
                  A4.
                </p>
                <small>
                  Choisissez jusqu’à 8 photos. L’image de couverture reste la
                  première.
                </small>
                <div className="pack-photo-selection">
                  {animal?.photos
                    .filter((p) => !p.archived_at)
                    .map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id) || chosen === p.id}
                          disabled={
                            chosen === p.id ||
                            (!selected.includes(p.id) && selected.length >= 8)
                          }
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, p.id]
                                : v.filter((x) => x !== p.id),
                            )
                          }
                        />
                        <img src={imageUrl(p.id, 320)} alt={p.filename} />
                      </label>
                    ))}
                </div>
                <Button
                  icon={Package}
                  disabled={!!busy || !chosen}
                  onClick={() => download("pack")}
                >
                  {busy === "pack"
                    ? "Préparation du pack…"
                    : "Télécharger le pack ZIP"}
                </Button>
              </div>
            </details>
          )}
        </div>
      </div>
    </Modal>
  );
}
