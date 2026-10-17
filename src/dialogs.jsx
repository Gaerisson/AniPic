import { hasAnimalInfo } from "../shared/animal-info.mjs";
import { PhotoTrash } from "./photo-trash.jsx";
import { UserAvatarEditor, UserPicture } from "./user-avatar.jsx";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  PawPrint,
  Archive,
  Trash2,
  Camera,
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  CheckCircle2,
  FolderPlus,
  Download,
  LogOut,
  Eye,
  EyeOff,
  CloudUpload,
  ExternalLink,
  Copy,
  Undo2,
  Sun,
  LoaderCircle,
  KeyRound,
  Edit3,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Heart,
  Video,
  Flag,
  Share2,
  Palette,
} from "lucide-react";
import {
  copyText,
  api,
  bytes,
  date,
  speciesName,
  imageUrl,
  animalAge,
} from "./api.js";
import { Spinner, Button, Modal } from "./ui.jsx";
import { DownloadOptions } from "./downloads.jsx";
import { AnimalStatus } from "./animal-status.jsx";
import { AnimalCompatibility } from "./compatibility.jsx";
import { AnimalExtraFacts } from "./animal-extra-facts.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
import { MediaTags, AnimalVideos } from "./animal-media.jsx";
import { PhotoComments } from "./photo-comments.jsx";
import { AnimalCommunication } from "./communication.jsx";
import { AnimalHistory } from "./animal-history.jsx";
import { UploadPreviews } from "./upload-feedback.jsx";
import { uploadWithProgress } from "./api.js";

export function Login({ onClose, session, onLogin, notify }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api("/login", { method: "POST", body: fields });
      onLogin(result.user);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Bienvenue dans l’atelier." onClose={onClose}>
      <div className="login-intro">
        <span className="login-paw">
          <PawPrint size={30} />
        </span>
        <p>
          Votre espace pour prendre soin des images
          <br />
          et de ceux qu’elles racontent.
        </p>
      </div>
      {session?.needsSetup ? (
        <div className="notice">
          <KeyRound size={20} />
          <span>
            Le premier compte se crée sur le serveur :
            <code>docker compose exec -it anipic npm run setup</code>Aucun mot
            de passe par défaut.
          </span>
        </div>
      ) : (
        <form onSubmit={submit} className="form-stack">
          <label>
            Identifiant
            <input
              name="name"
              required
              autoComplete="username"
              placeholder="Votre identifiant"
            />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Votre mot de passe"
            />
          </label>
          <Button disabled={busy} icon={busy ? LoaderCircle : ArrowRight}>
            {busy ? "Connexion…" : "Entrer dans l’atelier"}
          </Button>
        </form>
      )}
      {session?.demo && (
        <div className="demo-entry">
          <span>Vous explorez une démonstration locale.</span>
          <Button
            variant="secondary"
            icon={Sun}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api("/demo-session", { method: "POST" });
                onLogin(result.user);
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Explorer l’administration de démo
          </Button>
        </div>
      )}
      <p className="fineprint">
        <ShieldCheck size={14} /> Sessions protégées · Accès selon votre rôle
      </p>
    </Modal>
  );
}
export function AnimalDetail({
  animalId,
  close,
  open,
  notify,
  reload,
  version,
  canEdit,
  user,
  video,
  editPhoto,
  pushUndo,
}) {
  const [animal, setAnimal] = useState(null),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState([]);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [fullscreen, setFullscreen] = useState(false),
    [format, setFormat] = useState("jpeg"),
    [size, setSize] = useState("medium"),
    [layout, setLayout] = useState("fit");
  const drag = useRef();
  const viewerRef = useRef();
  const moved = useRef(false);
  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;
    const wheel = (e) => {
      e.preventDefault();
      setZoom((z) =>
        Math.max(
          1,
          Math.min(
            4,
            z * Math.exp(-Math.max(-160, Math.min(160, e.deltaY)) * 0.0014),
          ),
        ),
      );
      setPan({ x: 0, y: 0 });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [animal?.id, fullscreen]);
  const closeViewer = useCallback(
    () => (fullscreen ? setFullscreen(false) : close()),
    [fullscreen, close],
  );
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index, animalId]);
  useEffect(() => {
    const handler = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => (i + 1) % Math.max(1, photos.length));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => (i - 1 + photos.length) % Math.max(1, photos.length));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [animal?.photos]);
  const load = () =>
    api("/animals/" + animalId)
      .then(setAnimal)
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    load();
  }, [animalId, version]);
  const photos = animal?.photos.filter((p) => !p.archived_at) || [];
  const photo = photos[Math.min(index, photos.length - 1)];
  const updatePhoto = async (body) => {
    try {
      const previous = {
        caption: photo.caption,
        hidden: !!photo.hidden,
        archived: !!photo.archived_at,
        deleted: !!photo.deleted_at,
      };
      const result = await api("/photos/" + photo.id, {
        method: "PATCH",
        body,
      });
      if (!body.cover)
        pushUndo?.({
          label: `Photo · ${animal.name}`,
          run: () =>
            api("/photos/" + photo.id, {
              method: "PATCH",
              body: Object.fromEntries(
                Object.keys(body)
                  .filter((k) => k in previous)
                  .map((k) => [k, previous[k]]),
              ),
              headers: { "X-Photo-Version": result.revision },
            }),
        });
      notify("La photo a été mise à jour.");
      load();
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <Modal
      title={animal ? `${animal.name} · Son album` : "Son album"}
      onClose={closeViewer}
      wide
      className={"photo-modal " + (fullscreen ? "is-fullscreen" : "")}
      headerActions={
        photo && (
          <a
            className="button"
            href={`/api/photos/${photo.id}/download?format=jpeg&size=medium`}
          >
            <Download size={17} /> Télécharger
          </a>
        )
      }
    >
      {!animal ? (
        <Spinner />
      ) : (
        <>
          <div className="animal-detail">
            <div className="detail-gallery">
              <div
                ref={viewerRef}
                className={"detail-image " + (zoom > 1 ? "zoomed" : "")}
                onClick={(e) => {
                  if (e.target.closest("button")) return;
                  if (!moved.current) {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }
                  moved.current = false;
                }}
                style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
                onDoubleClick={(e) => {
                  if (
                    e.target.closest('button,a,input,select,[role="button"]')
                  ) {
                    e.stopPropagation();
                    return;
                  }
                  setZoom((z) => (z > 1 ? 1 : 2));
                  setPan({ x: 0, y: 0 });
                }}
                onPointerDown={(e) => {
                  moved.current = false;
                  if (
                    zoom <= 1 ||
                    e.target.closest('button,a,input,select,[role="button"]')
                  )
                    return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = { x: e.clientX, y: e.clientY, pan };
                }}
                onPointerMove={(e) => {
                  if (!drag.current) return;
                  const dx = e.clientX - drag.current.x,
                    dy = e.clientY - drag.current.y;
                  if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true;
                  const bounds = e.currentTarget.getBoundingClientRect();
                  const maxX = (bounds.width * (zoom - 1)) / 2,
                    maxY = (bounds.height * (zoom - 1)) / 2;
                  setPan({
                    x: Math.max(-maxX, Math.min(maxX, drag.current.pan.x + dx)),
                    y: Math.max(-maxY, Math.min(maxY, drag.current.pan.y + dy)),
                  });
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                {photo ? (
                  <img
                    src={
                      zoom > 1 && user
                        ? `/media/${photo.id}?full=1`
                        : imageUrl(photo.id, 1280)
                    }
                    alt={photo.caption || "Portrait de " + animal.name}
                    draggable={false}
                    style={{
                      transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                      transition: drag.current
                        ? "none"
                        : "transform 160ms cubic-bezier(.2,.7,.25,1)",
                    }}
                  />
                ) : animal.source_metadata?.thumbnail ? (
                  <SpaPhoto animal={animal} large />
                ) : (
                  <div className="detail-placeholder">
                    <Camera size={48} />
                    <span>Aucune photo locale</span>
                    {canEdit && (
                      <Button
                        icon={Upload}
                        onClick={() => open({ type: "upload", id: animal.id })}
                      >
                        Ajouter des photos
                      </Button>
                    )}
                  </div>
                )}
                {photos.length > 1 && (
                  <>
                    <button
                      className="lightbox-arrow prev"
                      aria-label="Photo précédente"
                      onClick={() =>
                        setIndex((index - 1 + photos.length) % photos.length)
                      }
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      className="lightbox-arrow next"
                      aria-label="Photo suivante"
                      onClick={() => setIndex((index + 1) % photos.length)}
                    >
                      <ChevronRight />
                    </button>
                  </>
                )}
                {photo && (
                  <span className="lightbox-counter">
                    {Math.min(index + 1, photos.length)} / {photos.length}
                  </span>
                )}
              </div>
              {photo && (
                <div className="viewer-toolbar">
                  <button
                    aria-label="Dézoomer"
                    onClick={() => {
                      setZoom((z) => Math.max(1, z - 0.5));
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <label>
                    <input
                      aria-label="Zoom de la photo"
                      type="range"
                      min={1}
                      max={4}
                      step={0.25}
                      value={zoom}
                      onChange={(e) => {
                        setZoom(Number(e.target.value));
                        setPan({ x: 0, y: 0 });
                      }}
                    />
                    <span>{Math.round(zoom * 100)}%</span>
                  </label>
                  <button
                    aria-label="Zoomer"
                    onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    aria-label={
                      fullscreen
                        ? "Quitter le plein écran"
                        : "Photo en plein écran"
                    }
                    onClick={() => setFullscreen(!fullscreen)}
                  >
                    {fullscreen ? (
                      <Minimize size={18} />
                    ) : (
                      <Maximize size={18} />
                    )}
                  </button>
                  {user && (
                    <button
                      className={
                        photo.liked ? "photo-like liked" : "photo-like"
                      }
                      aria-label={
                        photo.liked
                          ? "Retirer le like de cette photo"
                          : "Aimer cette photo"
                      }
                      aria-pressed={!!photo.liked}
                      onClick={async () => {
                        try {
                          await api("/photos/" + photo.id + "/like", {
                            method: "POST",
                            body: { liked: !photo.liked },
                          });
                          load();
                        } catch (e) {
                          notify(e.message, "error");
                        }
                      }}
                    >
                      <Heart
                        size={18}
                        fill={photo.liked ? "currentColor" : "none"}
                      />
                      {photo.likes || 0}
                    </button>
                  )}
                  <small>
                    Molette : zoom · clic : 100 % · glisser : déplacer · ← → :
                    photos
                  </small>
                </div>
              )}
              {photos.length > 0 && (
                <div className="thumbs">
                  {photos.map((p, i) => (
                    <div className="thumb-item" key={p.id}>
                      <button
                        className={index === i ? "selected" : ""}
                        onClick={() => setIndex(i)}
                        aria-label={`Photo ${i + 1}`}
                      >
                        <img src={imageUrl(p.id, 320)} alt="" />
                        {p.hidden && <EyeOff size={12} />}
                      </button>
                      {canEdit && (
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner la photo ${i + 1}`}
                          checked={selected.includes(p.id)}
                          onChange={() =>
                            setSelected(
                              selected.includes(p.id)
                                ? selected.filter((id) => id !== p.id)
                                : [...selected, p.id],
                            )
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {photo && (
                <div className="photo-meta">
                  <span>
                    {photo.filename} · {photo.width} × {photo.height} ·{" "}
                    {bytes(photo.size)}
                  </span>
                  {user && (
                    <a
                      href={`/media/${photo.id}?original=1`}
                      className="text-link"
                    >
                      <Download size={14} />
                      Original
                    </a>
                  )}
                </div>
              )}
              {photo && (
                <div className="photo-downloads">
                  <DownloadOptions photoId={photo.id} user={user} />
                </div>
              )}
              {photo && user && (
                <MediaTags
                  key={"tags-" + photo.id}
                  kind="photo"
                  id={photo.id}
                  canEdit={canEdit}
                  notify={notify}
                />
              )}
              {photo && user && (
                <PhotoComments
                  key={photo.id}
                  photo={photo}
                  user={user}
                  canEdit={canEdit}
                  notify={notify}
                />
              )}
            </div>
            <div className="detail-info">
              <div className="detail-eyebrow">
                <span className="tag sage">{speciesName[animal.species]}</span>
                <AnimalStatus animal={animal} />
                {animal.archived_at && (
                  <span className="tag sand">Album archivé</span>
                )}
              </div>
              <h2>
                {animal.name}
                <span>
                  {animal.sex === "female"
                    ? "♀"
                    : animal.sex === "male"
                      ? "♂"
                      : ""}
                </span>
              </h2>
              <p className="detail-description">
                {animal.description || "Description non renseignée par la SPA."}
              </p>
              <div className="detail-facts">
                {hasAnimalInfo(animal.breed) && (
                  <div>
                    <span>Race</span>
                    <strong>{animal.breed}</strong>
                  </div>
                )}
                {["female", "male"].includes(animal.sex) && (
                  <div>
                    <span>Sexe</span>
                    <strong>
                      {animal.sex === "female"
                        ? "Femelle"
                        : animal.sex === "male"
                          ? "Mâle"
                          : ""}
                    </strong>
                  </div>
                )}
                {(animal.birth_date ||
                  hasAnimalInfo(animal.source_metadata?.ageLabel)) && (
                  <div>
                    <span>
                      {animal.birth_date
                        ? "Naissance"
                        : "Âge indiqué par la SPA"}
                    </span>
                    <strong>
                      {animal.birth_date
                        ? date(animal.birth_date)
                        : animal.source_metadata?.ageLabel}
                    </strong>
                  </div>
                )}
                {hasAnimalInfo(animal.source_metadata?.size) && (
                  <div>
                    <span>Taille</span>
                    <strong>{animal.source_metadata.size}</strong>
                  </div>
                )}
                {animal.birth_date && (
                  <div>
                    <span>Âge</span>
                    <strong>{animalAge(animal.birth_date)}</strong>
                  </div>
                )}
                <div>
                  <span>Photographies</span>
                  <strong>{photos.length}</strong>
                </div>
                <div>
                  <span>Ajouté le</span>
                  <strong>{date(animal.created_at)}</strong>
                </div>
              </div>
              {Object.keys(animal.compatibility || {}).length > 0 && (
                <AnimalCompatibility values={animal.compatibility} />
              )}
              <AnimalExtraFacts animal={animal} />
              {user && (
                <AnimalCommunication
                  animal={animal}
                  photo={photo}
                  selected={selected}
                  open={open}
                  notify={notify}
                  reload={reload}
                  canEdit={canEdit}
                  onUpdate={load}
                />
              )}
              <AnimalHistory animalId={animal.id} user={user} compact />
              {animal.source_metadata?.descriptionEntente && (
                <p className="entente-description">
                  {animal.source_metadata.descriptionEntente}
                </p>
              )}
              {user && photos.length > 0 && (
                <a
                  className="button secondary full-width"
                  href={"/api/animals/" + animal.id + "/download"}
                >
                  <Download size={17} />
                  L’album complet · originaux ZIP
                </a>
              )}
              <div className="identity-box">
                <ShieldCheck size={17} />
                <div>
                  <strong>Informations issues de la SPA</strong>
                  <span>
                    ID source : {animal.source_id || "Fiche créée localement"}
                  </span>
                  <code>{animal.id}</code>
                </div>
                <button
                  className="icon-button"
                  aria-label="Copier l’identifiant"
                  onClick={() =>
                    copyText(animal.id)
                      .then(() => notify("Identifiant copié."))
                      .catch(() => notify("Copie indisponible.", "error"))
                  }
                >
                  <Copy size={15} />
                </button>
              </div>
              {animal.tags.length > 0 && (
                <div className="tags">
                  {animal.tags.map((tag) => (
                    <span className="tag sand" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {animal.source_url && /^https?:\/\//.test(animal.source_url) && (
                <a
                  className="text-link"
                  href={animal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Voir la fiche source <ExternalLink size={14} />
                </a>
              )}
              {canEdit && (
                <div className="detail-actions">
                  {photo && user?.role === "admin" && (
                    <Button
                      variant="secondary"
                      icon={Edit3}
                      onClick={() =>
                        editPhoto({
                          photoId: photo.id,
                          filename: photo.filename,
                        })
                      }
                    >
                      Retoucher cette photo
                    </Button>
                  )}
                  <Button icon={Video} onClick={() => video(animal)}>
                    Créer sa vidéo
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Palette}
                    onClick={() => {
                      location.hash = "canva/" + animal.id;
                      open({
                        type: "canva",
                        animalId: animal.id,
                        photoId: photo?.id,
                      });
                    }}
                  >
                    Créer dans Canva
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Share2}
                    onClick={() =>
                      open({ type: "post", animal, photoId: photo?.id })
                    }
                  >
                    Préparer une publication
                  </Button>
                  <Button
                    variant="secondary"
                    icon={Flag}
                    onClick={() => open({ type: "task", animal })}
                  >
                    Demander une séance
                  </Button>
                  <Button
                    icon={Upload}
                    onClick={() => open({ type: "upload", id: animal.id })}
                  >
                    Ajouter des photos
                  </Button>
                  <Button
                    variant="quiet"
                    icon={animal.archived_at ? Undo2 : Archive}
                    onClick={async () => {
                      try {
                        await api(`/animals/${animal.id}/archive`, {
                          method: "POST",
                          body: { archived: !animal.archived_at },
                        });
                        notify(
                          animal.archived_at
                            ? "Album restauré."
                            : "Album archivé. Tous les originaux sont conservés.",
                        );
                        reload();
                        load();
                      } catch (e) {
                        notify(e.message, "error");
                      }
                    }}
                  >
                    {animal.archived_at
                      ? "Restaurer l’album"
                      : "Archiver l’album"}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {user && (
            <AnimalVideos
              animalId={animal.id}
              canEdit={canEdit}
              notify={notify}
            />
          )}
          {canEdit && photo && (
            <div
              className={
                "photo-privacy-control " + (photo.hidden ? "is-private" : "")
              }
            >
              <span>
                {photo.hidden ? <EyeOff size={18} /> : <Eye size={18} />}{" "}
                {photo.hidden
                  ? "Photo privée · équipe uniquement"
                  : "Photo visible publiquement"}
              </span>
              <Button
                variant="secondary"
                icon={photo.hidden ? Eye : EyeOff}
                onClick={() => updatePhoto({ hidden: !photo.hidden })}
              >
                {photo.hidden ? "Rendre publique" : "Rendre privée"}
              </Button>
            </div>
          )}
          {canEdit && photo && (
            <form
              className="caption-editor"
              key={photo.id}
              onSubmit={(e) => {
                e.preventDefault();
                updatePhoto({
                  caption: new FormData(e.currentTarget).get("caption"),
                });
              }}
            >
              <label>
                Légende de cette photo
                <input
                  name="caption"
                  maxLength={300}
                  defaultValue={photo.caption}
                  placeholder="Un moment, une expression, une belle rencontre…"
                />
              </label>
              <Button icon={Check} variant="secondary">
                Enregistrer la légende
              </Button>
            </form>
          )}
          {canEdit && photo && (
            <div className="photo-management">
              <div>
                <strong>Gérer cette photo</strong>
                <span>
                  {photo.hidden
                    ? "Privée · visible uniquement à l’équipe"
                    : "Visible dans la photothèque"}
                </span>
              </div>
              <Button
                variant="secondary"
                icon={photo.hidden ? Eye : EyeOff}
                onClick={() => updatePhoto({ hidden: !photo.hidden })}
              >
                {photo.hidden ? "Publier" : "Rendre privée"}
              </Button>
              <Button
                variant="secondary"
                icon={Camera}
                onClick={() => updatePhoto({ cover: true })}
              >
                En couverture
              </Button>
              <Button
                variant="quiet"
                icon={Archive}
                onClick={() => updatePhoto({ archived: true })}
              >
                Archiver la photo
              </Button>
              <Button
                variant="quiet"
                icon={Trash2}
                onClick={() => updatePhoto({ deleted: true })}
              >
                Supprimer · corbeille
              </Button>
            </div>
          )}
          {canEdit && selected.length > 0 && (
            <div className="selection-bar">
              <span>{selected.length} photo(s) sélectionnée(s)</span>
              <Button
                icon={FolderPlus}
                onClick={() => open({ type: "collection", photoIds: selected })}
              >
                Ajouter à une collection
              </Button>
              <Button
                variant="secondary"
                icon={Eye}
                onClick={async () => {
                  try {
                    await api("/photos/batch", {
                      method: "POST",
                      body: { photoIds: selected, operation: "publish" },
                    });
                    notify("Sélection publiée.");
                    setSelected([]);
                    load();
                    reload();
                  } catch (e) {
                    notify(e.message, "error");
                  }
                }}
              >
                Publier
              </Button>
              <Button
                variant="secondary"
                icon={EyeOff}
                onClick={async () => {
                  try {
                    await api("/photos/batch", {
                      method: "POST",
                      body: { photoIds: selected, operation: "hide" },
                    });
                    notify("Sélection privée.");
                    setSelected([]);
                    load();
                    reload();
                  } catch (e) {
                    notify(e.message, "error");
                  }
                }}
              >
                Rendre privées
              </Button>
            </div>
          )}
          {canEdit && (
            <PhotoTrash
              animalId={animal.id}
              notify={notify}
              reload={() => {
                load();
                reload();
              }}
            />
          )}
          {animal.photos.some((p) => p.archived_at) && (
            <details className="archived-photos">
              <summary>
                {animal.photos.filter((p) => p.archived_at).length} photo(s)
                archivée(s)
              </summary>
              <div className="thumbs">
                {animal.photos
                  .filter((p) => p.archived_at)
                  .map((p) => (
                    <div key={p.id}>
                      <img src={imageUrl(p.id, 320)} alt="Photo archivée" />
                      {canEdit && (
                        <Button
                          variant="quiet"
                          onClick={async () => {
                            try {
                              await api("/photos/" + p.id, {
                                method: "PATCH",
                                body: { archived: false },
                              });
                              load();
                              reload();
                            } catch (e) {
                              notify(e.message, "error");
                            }
                          }}
                        >
                          Restaurer
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="quiet"
                          icon={Trash2}
                          onClick={async () => {
                            try {
                              await api("/photos/" + p.id, {
                                method: "PATCH",
                                body: { deleted: true },
                              });
                              load();
                              reload();
                              notify("Photo placée dans la corbeille.");
                            } catch (e) {
                              notify(e.message, "error");
                            }
                          }}
                        >
                          Supprimer
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </details>
          )}
        </>
      )}
    </Modal>
  );
}
export function UploadForm({ animalId, close, notify, reload, open }) {
  const [animals, setAnimals] = useState([]),
    [target, setTarget] = useState(animalId || ""),
    [files, setFiles] = useState([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [query, setQuery] = useState("");
  const ref = useRef();
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(
      () =>
        api("/animals?limit=60&sort=name&q=" + encodeURIComponent(query))
          .then((d) => {
            if (!cancelled) setAnimals(d.items);
          })
          .catch((e) => notify(e.message, "error")),
      150,
    );
    return () => {
      clearTimeout(timeout);
      cancelled = true;
    };
  }, [query]);
  const pick = (input) => {
    const f = Array.from(input || []);
    if (f.length > 30) {
      notify("30 photos maximum par lot.", "error");
      return;
    }
    setFiles(f);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!target || !files.length) return;
    setBusy(true);
    setProgress(0);
    const data = new FormData();
    for (const f of files) data.append("photos", f);
    try {
      const result = await uploadWithProgress(
        `/animals/${target}/photos`,
        data,
        setProgress,
      );
      setProgress(100);
      const duplicates = result.items.filter((i) => i.duplicate).length;
      notify(
        `${result.items.length - duplicates} photo(s) ajoutée(s)${duplicates ? " · " + duplicates + " doublon(s) évité(s)" : ""}.`,
      );
      reload();
      open({ type: "animal", id: target });
    } catch (e) {
      notify(e.message, "error");
      reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="De nouveaux moments à partager." onClose={close}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Retrouver un compagnon
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par prénom…"
          />
        </label>
        <label>
          À quel compagnon appartiennent ces photos ?
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          >
            <option value="">Choisir son album</option>
            {animals.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name} · {speciesName[a.species]} · {a.id.slice(0, 8)}
              </option>
            ))}
            {animalId && !animals.some((a) => a.id === animalId) && (
              <option value={animalId}>
                Album ouvert · {animalId.slice(0, 8)}
              </option>
            )}
          </select>
        </label>
        <div
          className={`dropzone ${files.length ? "has-files" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files);
          }}
          onClick={() => ref.current.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") ref.current.click();
          }}
        >
          <span>
            <CloudUpload size={34} />
          </span>
          <strong>
            {files.length
              ? files.length + " photo(s) prête(s) à rejoindre son album"
              : "Déposez vos photos ici"}
          </strong>
          <p>ou cliquez pour parcourir vos fichiers</p>
          <small>JPEG, PNG, WebP, AVIF · 30 fichiers par lot</small>
          <input
            ref={ref}
            hidden
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => pick(e.target.files)}
          />
        </div>
        {files.length > 0 && (
          <UploadPreviews files={files} busy={busy} progress={progress} />
        )}
        {files.length > 0 && (
          <div className="upload-summary">
            <span>
              {files.length} fichiers ·{" "}
              {bytes(files.reduce((sum, f) => sum + f.size, 0))}
            </span>
            <span>
              <CheckCircle2 size={14} />
              Déduplication automatique
            </span>
          </div>
        )}
        <div className="notice compact">
          <Eye size={17} />
          <span>
            Ces photos seront visibles. Vous pouvez les rendre privées ou les
            archiver depuis l’album.
          </span>
        </div>
        <Button
          disabled={busy || !target || !files.length}
          icon={busy ? LoaderCircle : Upload}
        >
          {busy ? "Importation des photos…" : "Ajouter à son album"}
        </Button>
      </form>
    </Modal>
  );
}
export function Account({ user, close, notify, onLogout }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Votre espace équipe." onClose={close}>
      <UserAvatarEditor user={user} notify={notify} />
      <div className="account-identity">
        <UserPicture user={user} />
        <div>
          <h3>{user.name}</h3>
          <span className="muted">
            {
              {
                admin: "Administrateur",
                editor: "Photographe",
                agent: "Agent SPA",
                viewer: "Lecteur",
              }[user.role]
            }
          </span>
        </div>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/account/password", {
              method: "PUT",
              body: Object.fromEntries(new FormData(e.currentTarget)),
            });
            notify("Votre mot de passe a été modifié.");
            e.target.reset();
          } catch (e) {
            notify(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Changer de mot de passe</h3>
        <label>
          Mot de passe actuel
          <input
            type="password"
            name="current"
            required
            autoComplete="current-password"
          />
        </label>
        <label>
          Nouveau mot de passe
          <input
            type="password"
            name="password"
            required
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
          />
        </label>
        <Button variant="secondary" icon={KeyRound} disabled={busy}>
          Mettre à jour le mot de passe
        </Button>
      </form>
      <Button
        className="logout-button"
        variant="quiet"
        icon={LogOut}
        onClick={onLogout}
      >
        Se déconnecter
      </Button>
    </Modal>
  );
}
