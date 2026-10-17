import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  Trash2,
  Undo2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  FolderInput,
  Video,
  Settings2,
  LoaderCircle,
} from "lucide-react";
import { api, imageUrl, bytes, date, uploadWithProgress } from "./api.js";
import { Button, Modal, Empty } from "./ui.jsx";
import { VideoPlayer } from "./video-player.jsx";
import { UploadPreviews, DropArea } from "./upload-feedback.jsx";
export const albumMediaUrl = (p, w = 640) =>
  p.kind === "private" ? `/api/album-media/${p.id}?w=${w}` : imageUrl(p.id, w);
function AlbumImage({ photo, user, style }) {
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const full = user
    ? photo.kind === "private"
      ? `/api/album-media/${photo.id}?full=1`
      : `/media/${photo.id}?full=1`
    : null;
  return (
    <>
      <div className="album-image-plane" style={style}>
        <img
          draggable={false}
          src={albumMediaUrl(photo, 1280)}
          alt={photo.caption || photo.filename}
        />
        {full && (
          <img
            key={attempt}
            className="album-image-original"
            draggable={false}
            src={full}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {full && !loaded && (
        <div className="album-image-status" role="status">
          {failed ? (
            <>
              Aperçu affiché · original indisponible
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFailed(false);
                  setAttempt((v) => v + 1);
                }}
              >
                Réessayer
              </button>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={15} />
              Chargement haute définition…
            </>
          )}
        </div>
      )}
    </>
  );
}
export async function dropIntoAlbum(e, destinationId, notify, reload) {
  const raw =
    e.dataTransfer.getData("application/x-anipic-album") ||
    e.dataTransfer.getData("application/x-anipic-item");
  if (!raw) return;
  e.preventDefault();
  e.stopPropagation();
  try {
    const v = JSON.parse(raw);
    if (v.albumId) {
      if (v.albumId === destinationId) return;
      await api("/collections/" + v.albumId, {
        method: "PATCH",
        body: { parentId: destinationId },
      });
    } else {
      if (!destinationId || v.from === destinationId) return;
      await api(`/collections/${v.from}/items/${v.id}`, {
        method: "PATCH",
        body: { kind: v.kind, destinationId },
      });
    }
    notify("Déplacement effectué.");
    reload();
  } catch (err) {
    notify(err.message, "error");
  }
}
export const allowAlbumDrop = (e) => {
  if (
    e.dataTransfer.types.some(
      (t) =>
        t === "application/x-anipic-album" || t === "application/x-anipic-item",
    )
  )
    e.preventDefault();
};
function useAlbums() {
  const [albums, setAlbums] = useState([]);
  useEffect(() => {
    api("/collections")
      .then(setAlbums)
      .catch(() => {});
  }, []);
  return albums;
}
function Destinations({ albums, current, value, onChange, root = false }) {
  return (
    <select
      aria-label="Dossier de destination"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">
        {root ? "Racine des albums" : "Choisir un album privé"}
      </option>
      {albums
        .filter((a) => a.id !== current && (root || !a.effective_public))
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.parent_id ? " · sous-dossier" : ""}
          </option>
        ))}
    </select>
  );
}
export function ManagedAlbumContent({
  album,
  canEdit,
  user,
  notify,
  reload,
  open,
  changePage,
}) {
  const input = useRef(),
    albums = useAlbums();
  const [files, setFiles] = useState([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [trash, setTrash] = useState(false),
    [removed, setRemoved] = useState([]),
    [destination, setDestination] = useState(album.parent_id || "");
  useEffect(() => {
    if (trash)
      api(`/collections/${album.id}?trash=1`)
        .then((a) => setRemoved(a.photos))
        .catch((e) => notify(e.message, "error"));
  }, [trash, album]);
  async function upload(selected) {
    if (busy || !selected.length) return;
    if (selected.length > 50) return notify("50 fichiers maximum.", "error");
    setFiles(selected);
    setBusy(true);
    setProgress(0);
    try {
      const body = new FormData();
      selected.forEach((f) => body.append("files", f));
      const r = await uploadWithProgress(
        `/collections/${album.id}/upload`,
        body,
        setProgress,
      );
      notify(`${r.photos.length} média(s) importé(s).`);
      setFiles([]);
      reload();
    } catch (e) {
      notify(e.message, "error");
      reload();
    } finally {
      setBusy(false);
    }
  }
  const items = trash ? removed : album.photos;
  return (
    <section
      className="album-content section-gap"
      onDragOver={(e) => {
        if (canEdit && e.dataTransfer.types.includes("Files"))
          e.preventDefault();
        else allowAlbumDrop(e);
      }}
      onDrop={(e) => {
        if (canEdit && e.dataTransfer.files.length) {
          e.preventDefault();
          upload(Array.from(e.dataTransfer.files));
        } else if (canEdit) dropIntoAlbum(e, album.id, notify, reload);
      }}
    >
      <header className="album-actions">
        <div>
          <h2>{album.name}</h2>
          <p>{album.description}</p>
        </div>
        <div>
          {canEdit && (
            <>
              <Button
                icon={Upload}
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                {busy ? "Import en cours…" : "Photos & vidéos"}
              </Button>
              <Button
                variant="secondary"
                icon={trash ? Undo2 : Trash2}
                onClick={() => setTrash((v) => !v)}
              >
                {trash ? "Revenir à l’album" : "Corbeille"}
              </Button>
            </>
          )}
          {user && album.photos.length > 0 && (
            <a
              className="button secondary"
              href={`/api/collections/${album.id}/download`}
            >
              <Download size={17} />
              Album · ZIP
            </a>
          )}
        </div>
      </header>
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
        onChange={(e) => {
          upload(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {canEdit && !trash && <DropArea disabled={busy} onFiles={upload} />}
      <UploadPreviews files={files} busy={busy} progress={progress} />
      {items.length ? (
        <div className="private-photo-grid">
          {items.map((p, index) => (
            <article
              className="managed-media"
              key={p.id}
              draggable={canEdit && !trash}
              onDragStart={(e) =>
                e.dataTransfer.setData(
                  "application/x-anipic-item",
                  JSON.stringify({ id: p.id, kind: p.kind, from: album.id }),
                )
              }
            >
              <button
                onClick={() =>
                  open({ type: "album-photo", album, photos: items, index })
                }
              >
                {p.mime?.startsWith("video/") ? (
                  <video
                    src={albumMediaUrl(p)}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={albumMediaUrl(p)}
                    alt={p.caption || p.filename}
                    loading="lazy"
                  />
                )}
                <span>
                  {p.filename || p.name}
                  <small>
                    {p.mime?.startsWith("video/") ? "Vidéo · " : ""}
                    {bytes(p.size)}
                  </small>
                </span>
              </button>
              {trash && canEdit && (
                <Button
                  icon={Undo2}
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api(`/collections/${album.id}/items/${p.id}`, {
                        method: "PATCH",
                        body: { deleted: false },
                      });
                      setRemoved((v) => v.filter((i) => i.id !== p.id));
                      reload();
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                >
                  Restaurer
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={trash ? "La corbeille est vide" : "Cet album est vide"}
          text={
            trash
              ? "Les originaux supprimés restent récupérables."
              : "Glissez des photos ou vidéos pour les importer."
          }
        />
      )}
      {!trash && changePage && album.pages > 1 && (
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={album.page === 1}
            onClick={() => changePage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span>
            {album.page} / {album.pages}
          </span>
          <Button
            variant="secondary"
            disabled={album.page >= album.pages}
            onClick={() => changePage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
      {canEdit && (
        <details className="album-edit">
          <summary>
            <Settings2 size={16} />
            Gérer l’album
          </summary>
          <form
            className="form-stack"
            key={album.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/collections/" + album.id, {
                  method: "PATCH",
                  body: {
                    name: f.get("name"),
                    description: f.get("description"),
                    isPublic: f.get("isPublic") === "on",
                  },
                });
                notify("Album enregistré.");
                reload();
              } catch (err) {
                notify(err.message, "error");
              }
            }}
          >
            <label>
              Nom
              <input
                name="name"
                defaultValue={album.name}
                required
                maxLength={80}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={album.description}
                maxLength={200}
              />
            </label>
            <label className="checkbox-label">
              <input
                name="isPublic"
                type="checkbox"
                defaultChecked={!!album.is_public}
              />
              Rendre cet album public
            </label>
            <Button>Enregistrer</Button>
          </form>
          <div className="album-move-row">
            <Destinations
              albums={albums}
              current={album.id}
              value={destination}
              onChange={setDestination}
              root
            />
            <Button
              icon={FolderInput}
              variant="secondary"
              onClick={async () => {
                try {
                  await api("/collections/" + album.id, {
                    method: "PATCH",
                    body: { parentId: destination || null },
                  });
                  notify("Album déplacé ; il reste privé.");
                  reload();
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              Déplacer l’album
            </Button>
          </div>
          <small>
            Un déplacement d’album le repasse en privé. Le contenu est conservé.
          </small>
        </details>
      )}
    </section>
  );
}
export function ManagedAlbumPhoto({
  photos,
  album,
  index: initial = 0,
  close,
  user,
  canEdit,
  notify,
  reload,
  pushUndo,
}) {
  const [items, setItems] = useState(photos),
    [index, setIndex] = useState(initial),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [destination, setDestination] = useState("");
  const area = useRef(),
    drag = useRef(),
    moved = useRef(false),
    albums = useAlbums(),
    p = items[index];
  const change = (n) => {
    setIndex((i) => (i + n + items.length) % items.length);
  };
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setEditing(false);
  }, [index]);
  useEffect(() => {
    const node = area.current;
    if (!node) return;
    const wheel = (e) => {
      if (e.target.closest("button,video")) return;
      e.preventDefault();
      setZoom((z) =>
        Math.max(
          1,
          Math.min(
            5,
            z * Math.exp(-Math.max(-160, Math.min(160, e.deltaY)) * 0.0014),
          ),
        ),
      );
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [index]);
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest("input,textarea,select,video")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        change(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        change(-1);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [items.length]);
  async function patch(body, { finish = false } = {}) {
    setBusy(true);
    try {
      await api(`/collections/${album.id}/items/${p.id}`, {
        method: "PATCH",
        body: { kind: p.kind, ...body },
      });
      reload();
      notify("Modification enregistrée.");
      if (finish) close();
      else {
        setItems((v) =>
          v.map((i) =>
            i.id === p.id
              ? { ...i, ...body, name: body.filename || i.name }
              : i,
          ),
        );
        setEditing(false);
      }
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const download =
    p.kind === "private"
      ? `/api/album-media/${p.id}?${user ? "original" : "download"}=1`
      : user
        ? `/media/${p.id}?original=1`
        : `/api/photos/${p.id}/download?format=jpeg&size=medium`;
  return (
    <Modal
      title={album.name + " · " + (index + 1) + " / " + items.length}
      onClose={() => !busy && close()}
      wide
      className="managed-album-view"
      headerActions={
        <a
          className="button"
          href={download}
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={17} />
          Télécharger
        </a>
      }
    >
      {p.mime?.startsWith("video/") ? (
        <VideoPlayer id={p.id} title={p.filename} src={albumMediaUrl(p)} />
      ) : (
        <div
          ref={area}
          className={"album-lightbox " + (zoom > 1 ? "zoomed" : "")}
          onClick={(e) => {
            if (e.target.closest("button")) return;
            if (!moved.current) {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }
            moved.current = false;
          }}
          onDoubleClick={(e) => {
            if (!e.target.closest("button")) setZoom((z) => (z > 1 ? 1 : 2));
          }}
          onPointerDown={(e) => {
            moved.current = false;
            if (zoom <= 1 || e.target.closest("button")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, pan };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x,
              dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
            const rect = e.currentTarget.getBoundingClientRect(),
              maxX = (rect.width * (zoom - 1)) / 2,
              maxY = (rect.height * (zoom - 1)) / 2;
            setPan({
              x: Math.max(-maxX, Math.min(maxX, drag.current.pan.x + dx)),
              y: Math.max(-maxY, Math.min(maxY, drag.current.pan.y + dy)),
            });
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
        >
          <AlbumImage
            key={p.id + ":" + (user?.id || "public")}
            photo={p}
            user={user}
            style={{
              transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              transition: drag.current ? "none" : "transform 160ms ease-out",
            }}
          />
        </div>
      )}
      <div className="album-lightbox-tools">
        <Button
          icon={ChevronLeft}
          variant="secondary"
          onClick={() => change(-1)}
        >
          Précédente
        </Button>
        {!p.mime?.startsWith("video/") && (
          <Button
            icon={ZoomIn}
            variant="secondary"
            onClick={() => {
              setZoom((z) => (z > 1 ? 1 : 2));
              setPan({ x: 0, y: 0 });
            }}
          >
            {Math.round(zoom * 100)} %
          </Button>
        )}
        <Button
          icon={ChevronRight}
          variant="secondary"
          onClick={() => change(1)}
        >
          Suivante
        </Button>
        {canEdit && !p.deleted_at && (
          <Button
            icon={Settings2}
            variant="secondary"
            onClick={() => setEditing((v) => !v)}
          >
            Gérer le média
          </Button>
        )}
      </div>
      <div className="album-photo-info">
        <strong>{p.filename}</strong>
        <span>
          {p.width} × {p.height} · {bytes(p.size)} · {p.mime} ·{" "}
          {date(p.created_at)}
        </span>
        {p.caption && <p>{p.caption}</p>}
      </div>
      {editing && (
        <section className="album-media-edit">
          {p.kind === "private" && (
            <form
              className="form-stack"
              key={p.id}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                patch({
                  filename: f.get("filename"),
                  caption: f.get("caption"),
                });
              }}
            >
              <label>
                Nom du fichier
                <input
                  required
                  maxLength={180}
                  name="filename"
                  defaultValue={p.filename}
                />
              </label>
              <label>
                Légende
                <textarea
                  name="caption"
                  maxLength={500}
                  defaultValue={p.caption}
                />
              </label>
              <Button disabled={busy}>Enregistrer</Button>
            </form>
          )}
          <div className="album-move-row">
            <Destinations
              albums={albums}
              current={album.id}
              value={destination}
              onChange={setDestination}
            />
            <Button
              disabled={!destination || busy}
              icon={FolderInput}
              onClick={() =>
                patch({ destinationId: destination }, { finish: true })
              }
            >
              Déplacer
            </Button>
          </div>
          <Button
            variant="secondary"
            icon={Trash2}
            disabled={busy}
            onClick={() => {
              const previous = p;
              patch({ deleted: true }, { finish: true }).then((ok) => {
                if (ok && p.kind === "private")
                  pushUndo?.({
                    label: "Remettre le média dans l’album",
                    run: async () => {
                      await api(
                        `/collections/${album.id}/items/${previous.id}`,
                        { method: "PATCH", body: { deleted: false } },
                      );
                      reload();
                    },
                  });
              });
            }}
          >
            {p.kind === "private"
              ? "Mettre à la corbeille"
              : "Retirer le lien de cet album"}
          </Button>
        </section>
      )}
    </Modal>
  );
}
