import { useState, useEffect, useRef } from "react";
import {
  Images,
  Folder,
  FolderPlus,
  LockKeyhole,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Globe,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api, imageUrl, bytes } from "./api.js";
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
        <button onClick={() => setParent(null)}>
          <Folder size={16} />
          Tous les albums
        </button>
        {trail.map((a) => (
          <span key={a.id}>
            <ChevronRight size={13} />
            <button onClick={() => setParent(a.id)}>{a.name}</button>
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
                  key={c.id}
                  onClick={() => setParent(c.id)}
                >
                  <div className="collection-cover">
                    {c.photos.slice(0, 4).map((p) => (
                      <img
                        key={p.id}
                        src={photoUrl(p, 320)}
                        alt=""
                        loading="lazy"
                      />
                    ))}
                    {!c.photos.length && <Folder size={42} />}
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
function AlbumContent({
  album,
  canEdit,
  user,
  notify,
  reload,
  open,
  changePage,
}) {
  const ref = useRef(),
    [busy, setBusy] = useState(false);
  return (
    <section className="album-content section-gap">
      <div className="album-actions">
        <div>
          <h2>{album.name}</h2>
          <p>{album.description}</p>
        </div>
        <div>
          {canEdit && (
            <Button
              icon={Upload}
              disabled={busy}
              onClick={() => ref.current?.click()}
            >
              {busy ? "Import en cours…" : "Ajouter des photos"}
            </Button>
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
      </div>
      <input
        ref={ref}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (!files.length) return;
          if (files.length > 50) {
            notify("50 photos maximum par import.", "error");
            return;
          }
          setBusy(true);
          try {
            const body = new FormData();
            files.forEach((f) => body.append("files", f));
            const r = await api(`/collections/${album.id}/upload`, {
              method: "POST",
              body,
            });
            notify(`${r.photos.length} photos importées.`);
            reload();
          } catch (e) {
            notify(e.message, "error");
            reload();
          } finally {
            setBusy(false);
          }
        }}
      />
      {album.photos.length ? (
        <div className="private-photo-grid">
          {album.photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() =>
                open({
                  type: "album-photo",
                  album,
                  photos: album.photos,
                  index: i,
                })
              }
            >
              <img src={photoUrl(p)} alt={p.caption || p.name} loading="lazy" />
              <span>
                {p.name}
                <small>{bytes(p.size)}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          icon={Images}
          title="Cet album attend ses premières images."
          text="Déposez ici vos photos de portes ouvertes, des agents ou du refuge."
        />
      )}
      {changePage && album.pages > 1 ? (
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
            disabled={album.page === album.pages}
            onClick={() => changePage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      ) : (
        album.photo_count > album.photos.length && (
          <p className="small-note">
            Les {album.photos.length} premières photos sont affichées. Le ZIP
            contient l’ensemble des photos de ce dossier.
          </p>
        )
      )}
      {canEdit && (
        <details className="album-settings">
          <summary>Gérer le nom et la visibilité de l’album</summary>
          <form
            className="form-stack"
            key={album.id + "-" + album.is_public}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await api(`/collections/${album.id}`, {
                  method: "PATCH",
                  body: {
                    name: form.get("name"),
                    description: form.get("description"),
                    isPublic: form.get("public") === "on",
                  },
                });
                notify("Album mis à jour.");
                reload();
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            <label>
              Nom
              <input
                name="name"
                defaultValue={album.name}
                maxLength={80}
                required
              />
            </label>
            <label>
              Description
              <input
                name="description"
                defaultValue={album.description}
                maxLength={200}
              />
            </label>
            <label className="checkbox-label">
              <input
                name="public"
                type="checkbox"
                defaultChecked={!!album.is_public}
              />
              Rendre cet album public
            </label>
            <p className="small-note">
              Les aperçus de cet album seront accessibles aux visiteurs si ses
              parents sont également publics.
            </p>
            <Button>Enregistrer</Button>
          </form>
        </details>
      )}
    </section>
  );
}
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
export function AlbumPhoto({ photos, album, index: initial = 0, close, user }) {
  const [index, setIndex] = useState(initial),
    [zoom, setZoom] = useState(1),
    p = photos[index];
  const zoomRef = useRef();
  useEffect(() => {
    const node = zoomRef.current;
    if (!node) return;
    const wheel = (e) => {
      e.preventDefault();
      setZoom((z) => Math.max(1, Math.min(4, z * Math.exp(-e.deltaY * 0.002))));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => setZoom(1), [index]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [photos.length]);
  const url =
    p.kind === "private"
      ? `/api/album-media/${p.id}?download=1`
      : `/api/photos/${p.id}/download?format=jpeg&size=medium`;
  return (
    <Modal
      title={album.name + " · " + (index + 1) + " / " + photos.length}
      onClose={close}
      wide
      headerActions={
        <a className="button" href={url}>
          <Download size={17} />
          Télécharger
        </a>
      }
    >
      <div ref={zoomRef} className="album-lightbox" onClick={() => setZoom(1)}>
        <img
          src={photoUrl(p, 1280)}
          alt={p.caption || p.name}
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
      <div className="album-lightbox-tools">
        <Button
          icon={ChevronLeft}
          variant="secondary"
          onClick={() =>
            setIndex((i) => (i - 1 + photos.length) % photos.length)
          }
        >
          Précédente
        </Button>
        <Button
          icon={zoom > 1 ? ZoomOut : ZoomIn}
          variant="secondary"
          onClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
        >
          {zoom > 1 ? "100 %" : "Zoomer"}
        </Button>
        <Button
          icon={ChevronRight}
          variant="secondary"
          onClick={() => setIndex((i) => (i + 1) % photos.length)}
        >
          Suivante
        </Button>
        {user && (
          <a
            className="text-link"
            href={
              p.kind === "private"
                ? `/api/album-media/${p.id}?original=1`
                : `/media/${p.id}?original=1`
            }
          >
            Original
          </a>
        )}
      </div>
    </Modal>
  );
}
