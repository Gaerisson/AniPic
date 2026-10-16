import { useState, useEffect } from "react";
import {
  Download,
  Images,
  LockKeyhole,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Modal, Button } from "./ui.jsx";
import { imageUrl, api } from "./api.js";

export function DownloadOptions({ photoId, user, onChange }) {
  const [format, setFormat] = useState("jpeg"),
    [size, setSize] = useState("medium"),
    [layout, setLayout] = useState("fit");
  useEffect(() => {
    onChange?.({ format, size, layout });
  }, [format, size, layout, onChange]);
  return (
    <div className="download-options">
      <label>
        Format
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="original" disabled={!user}>
            Original{!user ? " · connexion requise" : " intact"}
          </option>
        </select>
      </label>
      <label>
        Taille
        <select
          disabled={format === "original"}
          value={size}
          onChange={(e) => setSize(e.target.value)}
        >
          <option value="small">Petite · 800 px</option>
          <option value="medium">Moyenne · 1920 px</option>
          <option value="large">Grande · 3200 px</option>
          <option value="social">Réseaux · 1080 px</option>
        </select>
      </label>
      <label>
        Cadrage
        <select
          disabled={format === "original"}
          value={layout}
          onChange={(e) => setLayout(e.target.value)}
        >
          <option value="fit">Photo entière</option>
          <option value="square">Carré · 1080 × 1080</option>
          <option value="portrait">Publication · 1080 × 1350</option>
        </select>
      </label>
      <a
        className="button"
        href={`/api/photos/${photoId}/download?format=${format}&size=${size}&layout=${layout}`}
      >
        <Download size={17} />
        <span>Télécharger la photo</span>
      </a>
    </div>
  );
}
export function DownloadDialog({ photoId, animal, user, close, open }) {
  const [photos, setPhotos] = useState([{ id: photoId }]),
    [index, setIndex] = useState(0),
    [prefs, setPrefs] = useState({ format: "jpeg", layout: "fit" }),
    [ratio, setRatio] = useState(1.5);
  useEffect(() => {
    let active = true;
    api(`/animals/${animal.id}`)
      .then((a) => {
        if (active) {
          const list = a.photos.filter((p) => !p.archived_at);
          setPhotos(list);
          setIndex(
            Math.max(
              0,
              list.findIndex((p) => p.id === photoId),
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [animal.id, photoId]);
  const move = (dir) =>
    setIndex((i) => (i + dir + photos.length) % Math.max(1, photos.length));
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest("input,select,textarea")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [photos.length]);
  const current = photos[index]?.id || photoId,
    target =
      prefs.format === "original" || prefs.layout === "fit"
        ? ratio
        : prefs.layout === "square"
          ? 1
          : 0.8;

  return (
    <Modal
      title={`Télécharger · ${animal.name}`}
      onClose={close}
      className="download-modal"
    >
      <div className="download-preview-stage">
        <div
          className="download-crop-preview"
          style={{ aspectRatio: String(target) }}
        >
          <img
            src={imageUrl(current, 1280)}
            alt={`Photo de ${animal.name}`}
            onLoad={(e) =>
              setRatio(
                e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              )
            }
          />
          <i aria-hidden="true" />
        </div>
        {photos.length > 1 && (
          <>
            <Button
              variant="quiet"
              icon={ChevronLeft}
              aria-label="Photo précédente à télécharger"
              onClick={() => move(-1)}
            />
            <Button
              variant="quiet"
              icon={ChevronRight}
              aria-label="Photo suivante à télécharger"
              onClick={() => move(1)}
            />
          </>
        )}
        <span>
          {index + 1} / {photos.length}
        </span>
      </div>
      <DownloadOptions photoId={current} user={user} onChange={setPrefs} />
      <p className="small-note">
        L’export conserve la photo entière. Les formats de publication ajoutent
        des marges si nécessaire, sans couper l’animal.
      </p>
      <div className="download-dialog-actions">
        <Button
          variant="secondary"
          icon={Images}
          onClick={() => open({ type: "animal", id: animal.id })}
        >
          Voir l’album
        </Button>
        {user ? (
          <a
            className="button secondary"
            href={`/api/animals/${animal.id}/download`}
          >
            <Download size={17} />
            <span>Album complet · ZIP</span>
          </a>
        ) : (
          <Button
            variant="quiet"
            icon={LockKeyhole}
            onClick={() => open({ type: "login" })}
          >
            Se connecter pour les originaux
          </Button>
        )}
      </div>
    </Modal>
  );
}
