import {
  ManagedAlbumContent,
  ManagedAlbumPhoto,
  dropIntoAlbum,
  allowAlbumDrop,
} from "./album-manager.jsx";
import { useState, useEffect, useRef } from "react";
import {
  Folder,
  FolderPlus,
  LockKeyhole,
  ChevronRight,
  Globe,
} from "lucide-react";
import { api, imageUrl } from "./api.js";
import { Button, Modal, Spinner, Empty } from "./ui.jsx";
const photoUrl = (p, w = 640) =>
  p.kind === "private" ? `/api/album-media/${p.id}?w=${w}` : imageUrl(p.id, w);
export function Collections({ version, open, canEdit, user, notify, reload }) {
  const [albums, setAlbums] = useState(null),
    [parent, setParent] = useState(null),
    [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [albumPage, setAlbumPage] = useState(1);
  useEffect(() => setAlbumPage(1), [parent]);
  useEffect(() => {
    api("/collections")
      .then(setAlbums)
      .catch((e) => setError(e.message));
  }, [version, user?.id]);
  useEffect(() => {
    let cancelled = false;
    if (parent)
      api("/collections/" + parent + "?page=" + albumPage)
        .then((a) => {
          if (!cancelled) setDetail(a);
        })
        .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [parent, version, user?.id, albumPage]);
  const current =
      detail?.id === parent ? detail : albums?.find((a) => a.id === parent),
    children = albums?.filter((a) => (a.parent_id || null) === parent) || [];
  const trail = [];
  let cursor = current;
  while (cursor && trail.length < 12) {
    trail.unshift(cursor);
    cursor = albums?.find((a) => a.id === cursor.parent_id);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LA MÉMOIRE DE L’ÉQUIPE</div>
          <h1>
            Les albums<span className="heading-dot">.</span>
          </h1>
          <p>
            Portes ouvertes, vie du refuge, photos de l’équipe. Privés à leur
            création.
          </p>
        </div>
        <Button
          icon={FolderPlus}
          onClick={() =>
            canEdit
              ? open({ type: "collection", parentId: parent })
              : open({ type: "login" })
          }
        >
          {parent ? "Créer un sous-dossier" : "Créer un album"}
        </Button>
      </div>
      <div className="album-breadcrumbs">
        <button
          onClick={() => setParent(null)}
          onDragOver={allowAlbumDrop}
          onDrop={(e) => canEdit && dropIntoAlbum(e, null, notify, reload)}
        >
          <Folder size={16} />
          Tous les albums
        </button>
        {trail.map((a) => (
          <span key={a.id}>
            <ChevronRight size={13} />
            <button
              onClick={() => setParent(a.id)}
              onDragOver={allowAlbumDrop}
              onDrop={(e) => canEdit && dropIntoAlbum(e, a.id, notify, reload)}
            >
              {a.name}
            </button>
          </span>
        ))}
      </div>
      {error ? (
        <Empty title="Albums indisponibles" text={error} />
      ) : !albums ? (
        <Spinner />
      ) : (
        <>
          {children.length > 0 && (
            <div className="collection-grid">
              {children.map((c) => (
                <button
                  className="collection-card"
                  draggable={canEdit}
                  onDragStart={(e) =>
                    e.dataTransfer.setData(
                      "application/x-anipic-album",
                      JSON.stringify({ albumId: c.id }),
                    )
                  }
                  onDragOver={allowAlbumDrop}
                  onDrop={(e) =>
                    canEdit && dropIntoAlbum(e, c.id, notify, reload)
                  }
                  key={c.id}
                  onClick={() => setParent(c.id)}
                >
                  <div className="collection-cover">
                    {(c.covers || c.photos).slice(0, 4).map((p) =>
                      p.mime?.startsWith("video/") ? (
                        <video
                          key={p.id}
                          src={photoUrl(p, 320)}
                          muted
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            if (e.currentTarget.duration > 0)
                              e.currentTarget.currentTime = Math.min(
                                2,
                                e.currentTarget.duration * 0.35,
                              );
                          }}
                        />
                      ) : (
                        <img
                          key={p.id}
                          src={photoUrl(p, 320)}
                          alt=""
                          loading="lazy"
                        />
                      ),
                    )}
                    {!(c.covers || c.photos).length && <Folder size={42} />}
                  </div>
                  <div>
                    <span className="collection-label">
                      {c.effective_public ? (
                        <>
                          <Globe size={12} />
                          PUBLIC
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={12} />
                          PRIVÉ · ÉQUIPE
                        </>
                      )}
                    </span>
                    <h3>
                      {c.name}
                      <ChevronRight size={18} />
                    </h3>
                    <p>{c.description || "Un espace pour vos images."}</p>
                    <small>
                      {!c.photo_count &&
                        c.covers?.length > 0 &&
                        "Aperçu des sous-dossiers · "}
                      {c.photo_count} photos ·{" "}
                      {albums.filter((a) => a.parent_id === c.id).length}{" "}
                      sous-dossiers
                    </small>
                  </div>
                </button>
              ))}
            </div>
          )}
          {current ? (
            <AlbumContent
              album={current}
              {...{ canEdit, user, notify, reload, open }}
              changePage={setAlbumPage}
            />
          ) : !children.length ? (
            <Empty
              icon={LockKeyhole}
              title={
                user
                  ? "Votre premier album privé"
                  : "Les albums de l’équipe sont privés"
              }
              text={
                user
                  ? "Créez un album pour y déposer des photos diverses, puis organisez-le avec des sous-dossiers."
                  : "Connectez-vous pour retrouver les portes ouvertes et les photos de l’équipe."
              }
              action={
                !user && (
                  <Button onClick={() => open({ type: "login" })}>
                    Se connecter
                  </Button>
                )
              }
            />
          ) : null}
        </>
      )}
      <div className="notice section-gap">
        <LockKeyhole size={18} />
        <span>
          Les nouveaux albums sont réservés à l’équipe connectée. Un
          sous-dossier reste privé tant que chacun de ses dossiers parents n’est
          pas public. Les originaux restent accessibles à l’équipe.
        </span>
      </div>
    </>
  );
}
const AlbumContent = ManagedAlbumContent;
export function CollectionForm({
  close,
  notify,
  reload,
  photoIds = [],
  parentId = null,
}) {
  const [busy, setBusy] = useState(false),
    [existing, setExisting] = useState([]),
    [target, setTarget] = useState("");
  useEffect(() => {
    if (photoIds.length)
      api("/collections")
        .then(setExisting)
        .catch((e) => notify(e.message, "error"));
  }, [photoIds.length]);
  return (
    <Modal
      title={parentId ? "Créer un sous-dossier privé" : "Créer un album privé"}
      onClose={close}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const fields = Object.fromEntries(new FormData(e.currentTarget));
            await api(
              target ? `/collections/${target}/photos` : "/collections",
              {
                method: "POST",
                body: target ? { photoIds } : { ...fields, photoIds, parentId },
              },
            );
            notify(target ? "Photos ajoutées à l’album." : "Album privé créé.");
            reload();
            close();
          } catch (e) {
            notify(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {photoIds.length > 0 && existing.length > 0 && (
          <label>
            Album
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Créer un nouvel album</option>
              {existing.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!target && (
          <>
            <label>
              Nom
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Portes ouvertes, Photos de l’équipe…"
              />
            </label>
            <label>
              Description
              <textarea name="description" rows={3} maxLength={200} />
            </label>
          </>
        )}
        <div className="notice compact">
          <LockKeyhole size={18} />
          <span>
            {photoIds.length
              ? `${photoIds.length} photos sélectionnées, sans copie des fichiers.`
              : "Vous pourrez importer des photos et créer des sous-dossiers."}
          </span>
        </div>
        <Button disabled={busy} icon={FolderPlus}>
          {target ? "Ajouter les photos" : "Créer l’album privé"}
        </Button>
      </form>
    </Modal>
  );
}
export function CollectionView({ collection, close, ...actions }) {
  return (
    <Modal title={collection.name} onClose={close} wide>
      <AlbumContent album={collection} {...actions} />
    </Modal>
  );
}
export const AlbumPhoto = ManagedAlbumPhoto;
