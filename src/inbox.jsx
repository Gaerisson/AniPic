import { UploadPreviews } from "./upload-feedback.jsx";
import { uploadWithProgress } from "./api.js";
import { useState, useEffect, useRef } from "react";
import {
  Upload,
  FolderOpen,
  Check,
  CheckCheck,
  Camera,
  Archive,
  Undo2,
  Eye,
  Search,
  ArrowRight,
  Lock,
  RefreshCw,
} from "lucide-react";
import { api, bytes, speciesName, imageUrl } from "./api.js";
import { Button, Empty, Spinner, Modal } from "./ui.jsx";
import { AnimalStatus } from "./animal-status.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
const supported = (name) => /\.(jpe?g|png|webp|avif)$/i.test(name);
const preview = (id, width = 640) => `/api/inbox/${id}/preview?width=${width}`;
async function droppedFiles(transfer) {
  const output = [];
  let visited = 0;
  async function walk(entry, prefix = "", depth = 0) {
    if (++visited > 10000 || depth > 6)
      throw new Error(
        "Dossier trop volumineux ou trop profond. Choisissez un sous-dossier.",
      );
    if (output.length >= 501) return;
    if (entry.isFile) {
      if (!supported(entry.name)) return;
      const file = await new Promise((resolve, reject) =>
        entry.file(resolve, reject),
      );
      output.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        for (const child of batch)
          await walk(child, prefix + entry.name + "/", depth + 1);
      } while (batch.length && output.length < 501);
    }
  }
  const entries = Array.from(transfer.items || [])
    .map((i) => i.webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length) for (const entry of entries) await walk(entry);
  else
    for (const file of transfer.files) output.push({ file, path: file.name });
  return output;
}
export function Inbox({ user, canEdit, notify, reload, version, open }) {
  const [data, setData] = useState(null),
    [selected, setSelected] = useState([]),
    [folder, setFolder] = useState(""),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [progress, setProgress] = useState(null),
    [busy, setBusy] = useState(false),
    [assign, setAssign] = useState(false),
    [zoom, setZoom] = useState(null),
    [drag, setDrag] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]),
    [fileProgress, setFileProgress] = useState(0);
  const filesRef = useRef(),
    folderRef = useRef(),
    last = useRef(null),
    stop = useRef(false),
    importing = useRef(false);
  const refresh = () => {
    setSelected([]);
    setPage(1);
    setRevision((v) => v + 1);
    reload();
  };
  useEffect(() => {
    if (!canEdit || !data?.importFolderConfigured) return;
    const timer = setInterval(() => {
      if (!document.hidden) setRevision((v) => v + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, [canEdit, data?.importFolderConfigured]);
  useEffect(() => {
    setSelected([]);
    last.current = null;
  }, [folder, query, archived, page]);
  useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    const timer = setTimeout(
      () =>
        api(
          `/inbox?page=${page}&folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(query)}&archived=${Number(archived)}`,
        )
          .then((d) => {
            if (alive) setData(d);
          })
          .catch((e) => notify(e.message, "error")),
      150,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [canEdit, folder, query, archived, page, revision, version]);
  if (!canEdit)
    return (
      <Empty
        icon={Lock}
        title="Les imports de l’équipe"
        text="Connectez-vous avec un compte agent ou photographe pour déposer et trier les photos."
        action={
          !user && (
            <Button onClick={() => open({ type: "login", then: "inbox" })}>
              Se connecter
            </Button>
          )
        }
      />
    );
  const upload = async (entries) => {
    if (busy || importing.current) return;
    const images = entries.filter(({ file }) => supported(file.name));
    if (!images.length) {
      notify("Choisissez des exports JPEG, PNG, WebP ou AVIF.", "error");
      return;
    }
    if (images.length > 500) {
      notify("500 photos maximum par dépôt.", "error");
      return;
    }
    setUploadFiles(images.slice(0, 24).map((e) => e.file));
    setFileProgress(0);
    importing.current = true;
    setBusy(true);
    stop.current = false;
    let added = 0,
      duplicates = 0,
      completed = 0;
    try {
      for (const { file, path } of images) {
        if (stop.current) break;
        setProgress({ done: completed, total: images.length, name: file.name });
        const form = new FormData();
        form.append("photo", file);
        const parts = path.replace(/\\/g, "/").split("/");
        parts.pop();
        setFileProgress(0);
        const result = await uploadWithProgress(
          "/inbox/photos?folder=" + encodeURIComponent(parts.join("/")),
          form,
          setFileProgress,
        );
        result.duplicate ? duplicates++ : added++;
        completed++;
      }
      notify(
        `${added} photo(s) à trier${duplicates ? ` · ${duplicates} doublon(s) évité(s)` : ""}${stop.current ? " · dépôt interrompu" : ""}.`,
      );
    } catch (e) {
      notify(
        `${e.message} Les photos déjà déposées sont conservées ; vous pouvez reprendre le même dossier.`,
        "error",
      );
    } finally {
      importing.current = false;
      setBusy(false);
      setProgress(null);
      setUploadFiles([]);
      refresh();
    }
  };
  const choose = (items) =>
    upload(
      Array.from(items || []).map((file) => ({
        file,
        path: file.webkitRelativePath || file.name,
      })),
    );
  const toggle = (photo, index, event) => {
    if (event.shiftKey && last.current !== null) {
      const range = data.items
        .slice(Math.min(last.current, index), Math.max(last.current, index) + 1)
        .map((p) => p.id);
      setSelected((previous) => Array.from(new Set([...previous, ...range])));
    } else
      setSelected((previous) =>
        previous.includes(photo.id)
          ? previous.filter((v) => v !== photo.id)
          : [...previous, photo.id],
      );
    last.current = index;
  };
  const archive = async () => {
    setBusy(true);
    try {
      await api("/inbox/archive", {
        method: "POST",
        body: { photoIds: selected, archived: !archived },
      });
      setSelected([]);
      refresh();
      notify(
        archived
          ? "Photos remises à trier."
          : "Photos écartées. Vous pouvez les restaurer.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Photos à trier<span className="heading-dot">.</span>
          </h1>
          <p>Déposez vos exports, puis choisissez leur animal.</p>
        </div>
        <span className="tag">
          <Lock size={13} /> Équipe uniquement
        </span>
      </div>
      <section
        className={`inbox-drop ${drag ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) {
            try {
              await upload(await droppedFiles(e.dataTransfer));
            } catch (e) {
              notify(
                e.message?.startsWith("Dossier trop")
                  ? e.message
                  : "Dossier illisible. Utilisez le bouton Importer un dossier.",
                "error",
              );
            }
          }
        }}
      >
        <div className="inbox-drop-icon">
          <Upload size={28} />
        </div>
        <div>
          <h2>Vos photos, comme vous les exportez.</h2>
          <p>
            Glissez des photos ou un dossier. Les sous-dossiers sont conservés
            pour faciliter le tri.
          </p>
          <small>
            JPEG, PNG, WebP, AVIF · dépôt privé · aucune attribution automatique
            par le nom
          </small>
        </div>
        <div className="inbox-upload-actions">
          <Button
            icon={Upload}
            disabled={busy}
            onClick={() => filesRef.current.click()}
          >
            Importer des photos
          </Button>
          <Button
            icon={FolderOpen}
            variant="secondary"
            disabled={busy}
            onClick={() => folderRef.current.click()}
          >
            Importer un dossier
          </Button>
        </div>
        <input
          ref={filesRef}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => {
            choose(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          hidden
          webkitdirectory=""
          directory=""
          onChange={(e) => {
            choose(e.target.files);
            e.target.value = "";
          }}
        />
      </section>
      {progress && (
        <UploadPreviews
          files={uploadFiles}
          busy={busy}
          progress={Math.round(
            ((progress.done + fileProgress / 100) / progress.total) * 100,
          )}
        />
      )}
      {progress && (
        <div className="inbox-progress" role="status">
          <div>
            <strong>
              Dépôt {progress.done}/{progress.total}
            </strong>
            <span>{progress.name}</span>
            <button
              onClick={() => {
                stop.current = true;
              }}
            >
              Arrêter après cette photo
            </button>
          </div>
          <progress value={progress.done} max={progress.total} />
        </div>
      )}
      <div className="inbox-toolbar">
        <label>
          <FolderOpen size={16} />
          <select
            aria-label="Filtrer les imports par dossier"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous les dossiers</option>
            {data?.folders
              .filter((f) => f.folder)
              .map((f) => (
                <option key={f.folder} value={f.folder}>
                  {f.folder} · {f.count}
                </option>
              ))}
          </select>
        </label>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Rechercher une photo à trier"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Fichier ou dossier…"
          />
        </label>
        <button
          className={`filter-toggle ${archived ? "active" : ""}`}
          onClick={() => {
            setArchived((v) => !v);
            setPage(1);
            setFolder("");
          }}
        >
          <Archive size={15} />
          {archived ? "Voir les photos à trier" : "Photos écartées"}
        </button>
        {data?.importFolderConfigured && (
          <Button
            variant="secondary"
            icon={RefreshCw}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api("/inbox/scan", { method: "POST" });
                notify(
                  `${result.added} photo(s) depuis le dossier de dépôt${result.more ? " · relancez pour la suite" : ""}${result.limitReached ? " · choisissez un sous-dossier plus petit" : ""}${result.errors.length ? " · " + result.errors.length + " fichier(s) illisible(s)" : ""}.`,
                );
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
                refresh();
              }
            }}
          >
            Lire le dossier de dépôt
          </Button>
        )}
      </div>
      <div className="inbox-selection">
        <span>
          <strong>{data?.total || 0}</strong>{" "}
          {archived ? "photo(s) écartée(s)" : "photo(s) à trier"}
          {selected.length > 0 && ` · ${selected.length} sélectionnée(s)`}
        </span>
        <div>
          <button
            disabled={!data?.items.length || busy}
            onClick={() =>
              setSelected(
                data.items.every((p) => selected.includes(p.id))
                  ? []
                  : data.items.map((p) => p.id),
              )
            }
          >
            <CheckCheck size={16} /> Sélectionner la page
          </button>
          {selected.length > 0 && (
            <>
              <button disabled={busy} onClick={() => setSelected([])}>
                Désélectionner
              </button>
              <Button
                icon={archived ? Undo2 : Archive}
                variant="secondary"
                disabled={busy}
                onClick={archive}
              >
                {archived ? "Restaurer" : "Écarter"}
              </Button>
              {!archived && (
                <Button
                  icon={ArrowRight}
                  disabled={busy}
                  onClick={() => setAssign(true)}
                >
                  Attribuer à un animal
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {!data ? (
        <Spinner />
      ) : !data.items.length ? (
        <Empty
          icon={Camera}
          title={
            archived ? "Aucune photo écartée." : "La boîte de tri est prête."
          }
          text={
            folder || query
              ? "Élargissez les filtres pour retrouver vos photos."
              : "Importez vos exports Lightroom/Photoshop. Vous choisirez ensuite le bon animal, même en cas d’homonymes."
          }
        />
      ) : (
        <div className="inbox-grid">
          {data.items.map((photo, index) => (
            <article
              className={`inbox-card ${selected.includes(photo.id) ? "selected" : ""}`}
              key={photo.id}
            >
              <button
                className="inbox-photo"
                aria-label={`Sélectionner ${photo.filename}`}
                aria-pressed={selected.includes(photo.id)}
                onClick={(e) => toggle(photo, index, e)}
              >
                <img
                  src={preview(photo.id)}
                  alt={photo.filename}
                  loading="lazy"
                />
                <span className="inbox-check">
                  {selected.includes(photo.id) && <Check size={16} />}
                </span>
              </button>
              <div>
                <strong title={photo.filename}>{photo.filename}</strong>
                <small title={photo.folder}>
                  {photo.folder || "Sans dossier"} · {bytes(photo.size)}
                </small>
                <button
                  className="icon-button"
                  aria-label={`Agrandir ${photo.filename}`}
                  onClick={() => setZoom(photo)}
                >
                  <Eye size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {data?.pages > 1 && (
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span>
            {page}/{data.pages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
      {zoom && (
        <Modal title={zoom.filename} wide onClose={() => setZoom(null)}>
          <img
            className="inbox-zoom"
            src={preview(zoom.id, 1600)}
            alt={zoom.filename}
          />
        </Modal>
      )}
      {assign && (
        <AssignInbox
          photos={data.items.filter((p) => selected.includes(p.id))}
          close={() => setAssign(false)}
          notify={notify}
          done={() => {
            setAssign(false);
            setSelected([]);
            refresh();
          }}
        />
      )}
    </>
  );
}
function AssignInbox({ photos, close, notify, done }) {
  const [suggestions, setSuggestions] = useState([]),
    [rememberFolder, setRememberFolder] = useState(false);
  useEffect(() => {
    api("/inbox/suggestions", {
      method: "POST",
      body: { photoIds: photos.map((p) => p.id) },
    })
      .then((r) => setSuggestions(r.items))
      .catch((e) => notify(e.message, "error"));
  }, []);
  const [query, setQuery] = useState(""),
    [species, setSpecies] = useState("all"),
    [animals, setAnimals] = useState(null),
    [chosen, setChosen] = useState(null),
    [hidden, setHidden] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () =>
        api(
          `/animals?limit=30&sort=name&species=${species}&q=${encodeURIComponent(query)}`,
        )
          .then((d) => {
            if (alive) setAnimals(d.items);
          })
          .catch((e) => notify(e.message, "error")),
      180,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, species]);
  return (
    <Modal
      title={`Attribuer ${photos.length} photo${photos.length > 1 ? "s" : ""}`}
      wide
      onClose={() => !busy && close()}
    >
      <div className="assign-photo-strip">
        {photos.slice(0, 12).map((p) => (
          <img key={p.id} src={preview(p.id, 160)} alt={p.filename} />
        ))}
        {photos.length > 12 && <span>+{photos.length - 12}</span>}
      </div>
      <div className="assign-search">
        {suggestions.length > 0 && (
          <section className="assign-suggestions">
            <h3>Suggestions d’après le dossier</h3>
            <div>
              {suggestions.map((a) => (
                <button
                  key={a.id}
                  className={chosen?.id === a.id ? "selected" : ""}
                  onClick={() => setChosen(a)}
                >
                  {a.cover_id ? (
                    <img src={imageUrl(a.cover_id, 320)} alt="" />
                  ) : a.hasSpaPhoto ? (
                    <span className="assign-animal-thumb">
                      <SpaPhoto animal={a} compact />
                      <i aria-hidden="true">SPA</i>
                    </span>
                  ) : (
                    <Camera size={24} />
                  )}
                  <span>
                    <strong>
                      {a.name} · {speciesName[a.species]}
                    </strong>
                    <code>{a.source_id || a.id.slice(0, 8)}</code>
                    <small>{a.reason}</small>
                  </span>
                  {chosen?.id === a.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </section>
        )}
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Rechercher l’animal destinataire"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom ou identifiant SPA…"
          />
        </label>
        <select
          aria-label="Espèce de l’animal destinataire"
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
        >
          <option value="all">Toutes les espèces</option>
          <option value="dog">Chiens</option>
          <option value="cat">Chats</option>
          <option value="other">NAC</option>
        </select>
      </div>
      <div className="assign-animals">
        {animals === null ? (
          <Spinner />
        ) : !animals.length ? (
          <p>Aucun animal ne correspond à la recherche.</p>
        ) : (
          animals.map((a) => (
            <button
              key={a.id}
              aria-pressed={chosen?.id === a.id}
              onClick={() => setChosen(a)}
            >
              {a.cover_id ? (
                <img src={imageUrl(a.cover_id, 320)} alt="" />
              ) : a.source_metadata?.thumbnail ? (
                <span className="assign-animal-thumb">
                  <SpaPhoto animal={a} compact />
                  <i aria-hidden="true">SPA</i>
                </span>
              ) : (
                <span className="assign-placeholder">
                  <Camera size={23} />
                </span>
              )}
              <span>
                <strong>{a.name}</strong>
                <small>
                  {speciesName[a.species]} ·{" "}
                  {a.sex === "female"
                    ? "Femelle"
                    : a.sex === "male"
                      ? "Mâle"
                      : "Sexe non précisé"}
                </small>
                <code>{a.source_id || a.id.slice(0, 8)}</code>
              </span>
              <AnimalStatus animal={a} compact />
              {chosen?.id === a.id && <Check size={19} />}
            </button>
          ))
        )}
      </div>
      <label className="checkbox-label inbox-private-choice">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
        />
        Garder les photos privées après attribution
      </label>
      {photos.some((p) => p.folder) && (
        <label className="checkbox-label inbox-private-choice">
          <input
            type="checkbox"
            checked={rememberFolder}
            onChange={(e) => setRememberFolder(e.target.checked)}
          />
          Suggérer cet animal pour les prochains exports dans ce dossier
        </label>
      )}
      <div className="assign-footer">
        <span>
          {chosen
            ? `${chosen.name} · ${chosen.source_id || chosen.id.slice(0, 8)}`
            : "Choisissez le bon animal avant de valider."}
        </span>
        <Button
          icon={ArrowRight}
          disabled={!chosen || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await api("/inbox/assign", {
                method: "POST",
                body: {
                  photoIds: photos.map((p) => p.id),
                  animalId: chosen.id,
                  hidden,
                  rememberFolder,
                },
              });
              notify(
                `${result.added} photo(s) attribuée(s) à ${chosen.name}${result.duplicates ? ` · ${result.duplicates} déjà présente(s)` : ""}.`,
              );
              done();
            } catch (e) {
              notify(e.message, "error");
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Attribution…"
            : `Attribuer${chosen ? " à " + chosen.name : ""}`}
        </Button>
      </div>
    </Modal>
  );
}
