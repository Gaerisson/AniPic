import { useState, useEffect } from "react";
import { Trash2, Undo2, LoaderCircle, Archive } from "lucide-react";
import { api, imageUrl, date, bytes } from "./api.js";
import { Button } from "./ui.jsx";
export function PhotoTrash({ animalId, notify, reload, user }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(""),
    [confirming, setConfirming] = useState(false),
    [job, setJob] = useState(null);
  async function load() {
    try {
      setData(await api("/trash" + (animalId ? "?animalId=" + animalId : "")));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (!job) return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const items = await api("/admin/jobs"),
          row = items.find((r) => r.id === job);
        if (!alive || !row || row.state === "running") return;
        setJob(null);
        setBusy(false);
        if (row.state !== "done") {
          setError(row.detail || "Vidage interrompu. Vérifiez le journal.");
          return;
        }
        const r = JSON.parse(row.detail);
        notify(
          r.deleted +
            " photo(s) supprimée(s), " +
            r.animals +
            " archive(s) retirée(s) · " +
            bytes(r.freedBytes) +
            " libérés." +
            (r.skipped
              ? " " +
                r.skipped +
                " photo(s) encore utilisées par des projets conservées."
              : "") +
            (r.fileErrors
              ? " Certains fichiers n’ont pas pu être retirés du stockage."
              : ""),
        );
        setConfirming(false);
        setConfirm("");
        await load();
        reload();
      } catch (e) {
        if (alive) setError(e.message);
      }
    }, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [job]);
  async function restore(url) {
    setBusy(true);
    try {
      await api(url, { method: "POST", body: {} });
      await load();
      reload();
      notify("Archive restaurée.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const photos = data?.photos || [],
    animals = data?.animals || [],
    canPurge = data?.canPurge ?? user?.role === "admin";
  return (
    <details
      className="panel photo-trash"
      onToggle={(e) => {
        if (e.currentTarget.open) load();
      }}
    >
      <summary>
        <Trash2 size={16} /> Corbeille · photos d’animaux et archives
      </summary>
      <p className="small-note">
        Les éléments restent restaurables jusqu’au vidage. Vider la corbeille
        crée et vérifie d’abord une sauvegarde protégée. Les originaux encore
        utilisés ailleurs restent conservés.
      </p>
      {data?.retainedLegacy > 0 && (
        <p className="small-note">
          {data.retainedLegacy} ancienne(s) fiche(s) déjà purgée(s) contiennent
          encore des métadonnées. Vider la corbeille les retire définitivement
          de la base après sauvegarde vérifiée.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {busy && (
        <p role="status">
          <LoaderCircle className="spin" size={16} />{" "}
          {job
            ? "Sauvegarde, vérification et vidage en cours… Vous pouvez consulter le journal des opérations."
            : "Traitement…"}
        </p>
      )}
      {data &&
        canPurge &&
        (photos.length > 0 ||
          animals.length > 0 ||
          data.retainedLegacy > 0) && (
          <div className="trash-actions">
            <Button
              variant="danger"
              icon={Trash2}
              disabled={busy}
              onClick={() => {
                setConfirming((v) => !v);
                setConfirm("");
              }}
            >
              Vider la corbeille{animalId ? " de cet animal" : ""}
            </Button>
          </div>
        )}
      {confirming && (
        <div className="trash-confirm">
          <p>
            Après sauvegarde vérifiée, les photos seront supprimées
            définitivement de cette corbeille et les fichiers inutilisés seront
            retirés du stockage. Les photos utilisées dans un projet ou une
            affiche restent protégées. Saisissez <strong>VIDER</strong> pour
            confirmer.
          </p>
          <input
            aria-label="Confirmation du vidage"
            value={confirm}
            disabled={busy}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
          <Button
            disabled={busy || confirm !== "VIDER"}
            icon={busy ? LoaderCircle : Trash2}
            variant="danger"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api("/admin/trash/empty", {
                  method: "POST",
                  body: { confirm, ...(animalId ? { animalId } : {}) },
                });
                setJob(r.id);
              } catch (e) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            Sauvegarder et vider
          </Button>
        </div>
      )}
      <div className="trash-grid">
        {animals.map((a) => (
          <article key={a.id}>
            <Archive size={26} />
            <strong>{a.name}</strong>
            <small>
              Fiche archivée · {a.photos} photo(s) · {date(a.at)}
            </small>
            <Button
              icon={Undo2}
              variant="secondary"
              disabled={busy}
              onClick={() => restore("/animals/" + a.id + "/trash/restore")}
            >
              Restaurer l’archive
            </Button>
          </article>
        ))}
        {photos.map((p) => (
          <article key={p.id}>
            <img src={imageUrl(p.id, 320)} alt={p.filename} />
            <strong>{p.name}</strong>
            <small>
              {p.filename} · {date(p.deleted_at)}
            </small>
            <Button
              type="button"
              icon={Undo2}
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/photos/" + p.id, {
                    method: "PATCH",
                    body: { deleted: false },
                  });
                  await load();
                  reload();
                  notify("Photo restaurée.");
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restaurer
            </Button>
          </article>
        ))}
      </div>
      {data?.photoTotal > photos.length && (
        <p>
          Les {photos.length} premiers portraits supprimés sont affichés sur{" "}
          {data.photoTotal}. Le vidage traite toute cette corbeille.
        </p>
      )}
      {data && !photos.length && !animals.length && (
        <p>La corbeille est vide.</p>
      )}
    </details>
  );
}
