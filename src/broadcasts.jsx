import { VideoPlayer } from "./video-player.jsx";
import { useState, useEffect } from "react";
import { Tv, Play, Folder, LockKeyhole, Search, RefreshCw } from "lucide-react";
import { api, bytes, date } from "./api.js";
import { Button, Empty, Spinner, Modal } from "./ui.jsx";
export function Broadcasts({ user, open, ui }) {
  const allowed = !!user || ui?.pageAccess?.broadcasts === "public";
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [folder, setFolder] = useState(""),
    [selected, setSelected] = useState(null),
    [playError, setPlayError] = useState("");
  const load = () => {
    setData(null);
    setError("");
    api("/broadcasts")
      .then(setData)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    if (allowed) load();
  }, [user?.id, allowed]);
  if (!allowed)
    return (
      <Empty
        icon={LockKeyhole}
        title="Les émissions du refuge"
        text="Connectez-vous pour regarder les émissions stockées."
        action={
          <Button onClick={() => open({ type: "login" })}>Se connecter</Button>
        }
      />
    );
  const list =
    data?.videos.filter(
      (v) =>
        (!folder || v.folder === folder) &&
        `${v.title} ${v.folder}`.toLowerCase().includes(query.toLowerCase()),
    ) || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LA VIDÉOTHÈQUE</div>
          <h1>
            Vidéo C8<span className="heading-dot">.</span>
          </h1>
          <p>Animaux à adopter · Vos émissions, depuis votre stockage.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={load}>
          Actualiser
        </Button>
      </div>
      {error ? (
        <Empty title="Vidéothèque indisponible" text={error} />
      ) : !data ? (
        <Spinner />
      ) : !data.configured ? (
        <div className="panel broadcast-empty">
          <Tv size={45} />
          <h2>Prête à accueillir vos émissions.</h2>
          <p>
            Le dossier se configure avec <code>BROADCAST_DIR</code>. Dans
            Docker, montez-le en lecture seule sur <code>/broadcasts</code>.
          </p>
          <p>
            Les fichiers sont lus directement sur le NAS. Anipic ne les copie
            pas et ne génère pas de miniature vidéo.
          </p>
        </div>
      ) : !data.available ? (
        <Empty title="Stockage C8 indisponible" text={data.message} />
      ) : (
        <>
          <div className="broadcast-filters">
            <label className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une émission…"
              />
            </label>
            <select
              aria-label="Dossier des émissions"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            >
              <option value="">Tous les dossiers</option>
              {[...new Set(data.videos.map((v) => v.folder))].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <span>{list.length} émissions</span>
          </div>
          <div className="broadcast-grid">
            {list.map((v) => (
              <button
                className="broadcast-card"
                key={v.id}
                onClick={() => {
                  setSelected(v);
                  setPlayError("");
                }}
              >
                <span className="broadcast-art">
                  <Tv size={40} />
                  <i>
                    <Play size={20} />
                  </i>
                </span>
                <div>
                  <small>
                    <Folder size={13} />
                    {v.folder}
                  </small>
                  <h3>{v.title}</h3>
                  <p>
                    {v.format} · {bytes(v.size)} · {date(v.updatedAt)}
                  </p>
                  {!v.playable && <em>MKV · conversion MP4 recommandée</em>}
                </div>
              </button>
            ))}
          </div>
          {!list.length && (
            <Empty
              title="Aucune émission dans cette sélection"
              text="Ajoutez vos fichiers MP4 ou WebM au dossier monté, puis actualisez."
            />
          )}
          {data.limited && (
            <p className="small-note">
              Affichage limité à 2 000 vidéos et 4 niveaux de dossiers.
            </p>
          )}
        </>
      )}
      {selected && (
        <Modal
          title={selected.title}
          onClose={() => setSelected(null)}
          wide
          className="broadcast-player"
        >
          <VideoPlayer
            id={selected.id}
            title={selected.title}
            src={`/api/broadcasts/${selected.id}/file`}
          />
          {playError && <div className="notice">{playError}</div>}
          <p>
            {selected.folder} · {selected.format} · Lecture privée depuis le NAS
          </p>
        </Modal>
      )}
    </>
  );
}
