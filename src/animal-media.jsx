import { useEffect, useState } from "react";
import { DropArea, UploadPreviews } from "./upload-feedback.jsx";
import { uploadWithProgress } from "./api.js";
import { Film, Upload, Trash2, Tag, Plus, Save } from "lucide-react";
import { api, bytes } from "./api.js";
import { Button } from "./ui.jsx";
export function MediaTags({ kind, id, canEdit, notify }) {
  const [tags, setTags] = useState([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api(`/media-tags/${kind}/${id}`)
      .then((r) => alive && setTags(r.tags))
      .catch((e) => notify(e.message, "error"));
    return () => {
      alive = false;
    };
  }, [id, kind]);
  const save = async (values) => {
    setBusy(true);
    try {
      const r = await api(`/media-tags/${kind}/${id}`, {
        method: "PUT",
        body: { tags: values },
      });
      setTags(r.tags);
      setText("");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="media-tags">
      <div className="media-tags-list">
        <Tag size={15} />
        {tags.map((t) => (
          <button
            type="button"
            key={t}
            disabled={!canEdit || busy}
            title={canEdit ? "Retirer ce tag" : t}
            onClick={() => save(tags.filter((v) => v !== t))}
          >
            {t}
            {canEdit ? " ×" : ""}
          </button>
        ))}
        {!tags.length && <small>Aucun thème</small>}
      </div>
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const values = text
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
            if (values.length) save([...new Set([...tags, ...values])]);
          }}
        >
          <input
            aria-label="Ajouter des tags"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            placeholder="Noël, Halloween…"
          />
          <Button
            icon={Plus}
            variant="secondary"
            disabled={!text.trim() || busy}
          >
            Tag
          </Button>
        </form>
      )}
    </div>
  );
}
export function AnimalVideos({ animalId, canEdit, notify }) {
  const [files, setFiles] = useState([]),
    [progress, setProgress] = useState(0);
  const [items, setItems] = useState([]),
    [assets, setAssets] = useState([]),
    [pick, setPick] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api(`/animals/${animalId}/videos`).then((r) => setItems(r.items));
  useEffect(() => {
    load().catch((e) => notify(e.message, "error"));
    if (canEdit)
      api("/video/assets")
        .then((r) => setAssets(r.filter((v) => v.kind === "video")))
        .catch(() => {});
  }, [animalId]);
  const attach = async (assetId) => {
    await api(`/animals/${animalId}/videos`, {
      method: "POST",
      body: { assetId },
    });
    await load();
    setPick("");
  };
  const upload = async (file) => {
    if (!file || busy) return;
    setFiles([file]);
    setProgress(0);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const v = await uploadWithProgress(
        "/video/assets?kind=video",
        body,
        setProgress,
      );
      await attach(v.id);
      notify("Vidéo ajoutée à la fiche, privée par défaut.");
      setFiles([]);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const update = async (v, values) => {
    try {
      await api(`/animal-videos/${v.id}`, {
        method: "PATCH",
        body: { caption: v.caption, showOnTv: v.show_on_tv, ...values },
      });
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return (
    <section className="animal-videos panel">
      {canEdit && (
        <>
          <DropArea onFiles={(f) => upload(f[0])} disabled={busy} />
          <UploadPreviews files={files} busy={busy} progress={progress} />
        </>
      )}
      <div className="section-heading">
        <div>
          <h3>
            <Film size={20} /> Vidéos de{" "}
            {items.length ? "la fiche" : "l’animal"}
          </h3>
          <p className="muted">
            {items.length
              ? `${items.length} vidéo(s)`
              : "Ajoutez un moment de vie à sa présentation."}
          </p>
        </div>
        {canEdit && (
          <label className={`button secondary ${busy ? "disabled" : ""}`}>
            <Upload size={17} />
            <span>{busy ? "Import…" : "Ajouter une vidéo"}</span>
            <input
              type="file"
              hidden
              accept="video/mp4,video/webm,video/quicktime"
              disabled={busy}
              onChange={(e) => upload(e.target.files[0])}
            />
          </label>
        )}
      </div>
      {canEdit && (
        <div className="media-attach">
          <select
            aria-label="Vidéo du studio"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Choisir dans les médias du studio…</option>
            {assets
              .filter((a) => !items.some((v) => v.asset_id === a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.filename}
                </option>
              ))}
          </select>
          <Button
            icon={Plus}
            disabled={!pick || busy}
            variant="secondary"
            onClick={() =>
              attach(pick).catch((e) => notify(e.message, "error"))
            }
          >
            Associer
          </Button>
        </div>
      )}
      <div className="animal-video-grid">
        {items.map((v) => (
          <article key={v.id}>
            <video src={v.src} controls playsInline preload="metadata" />
            <div className="video-meta">
              <strong>{v.caption || v.filename}</strong>
              <small>
                {Math.round(v.duration)} s · {bytes(v.size)}
              </small>
              {canEdit && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      update(v, {
                        caption: new FormData(e.currentTarget).get("caption"),
                      });
                    }}
                  >
                    <input
                      aria-label="Légende vidéo"
                      name="caption"
                      defaultValue={v.caption}
                      maxLength={200}
                      placeholder="Légende de la vidéo"
                    />
                    <Button icon={Save} variant="quiet">
                      OK
                    </Button>
                  </form>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={v.show_on_tv}
                      onChange={(e) =>
                        update(v, { showOnTv: e.target.checked })
                      }
                    />
                    Autoriser sur la TV publique
                  </label>
                  <Button
                    icon={Trash2}
                    variant="quiet"
                    onClick={async () => {
                      try {
                        await api(`/animal-videos/${v.id}`, {
                          method: "DELETE",
                        });
                        await load();
                      } catch (e) {
                        notify(e.message, "error");
                      }
                    }}
                  >
                    Détacher de la fiche
                  </Button>
                </>
              )}
              <MediaTags
                kind="video"
                id={v.asset_id}
                canEdit={canEdit}
                notify={notify}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
