import { AnnualStatistics } from "./annual-statistics.jsx";
import {
  logoAnimations,
  particleStyles,
  visualThemes,
} from "../shared/visual-themes.mjs";
import { DropArea, UploadPreviews } from "./upload-feedback.jsx";
import { uploadWithProgress } from "./api.js";
import { useState, useEffect, useRef } from "react";
import { StudioTimeline, filmTime } from "./studio-timeline.jsx";
import { StudioClipInspector } from "./studio-clip-inspector.jsx";
import "./studio-workspace.css";
import { Player } from "@remotion/player";
import { AnimalFilm } from "../video/AnimalFilm.jsx";
import { ImageReady } from "./asset-readiness.jsx";
import {
  dimensions,
  filmDuration,
  FPS,
  narrationFrames,
  moveFilmClip,
} from "../video/timing.mjs";
import {
  Video,
  Music,
  Image,
  Plus,
  Upload,
  Save,
  Film,
  Download,
  Play,
  Archive,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { api, bytes, date, imageUrl, speciesName, uid } from "./api.js";
import { Button, Empty, Spinner } from "./ui.jsx";
import { AnnualPicker } from "./annual-picker.jsx";
import { MusicCatalog } from "./music-catalog.jsx";
import { StudioTrash } from "./studio-trash.jsx";
import { VoicePanel } from "./voice-panel.jsx";
import { SubtitlePanel } from "./subtitle-panel.jsx";
const emptyFilm = {
  title: "Une nouvelle rencontre",
  subtitle: "Refuge de Morée",
  outro: "Une photo. Une rencontre. Une nouvelle histoire.",
  template: "presentation",
  aspect: "landscape",
  resolution: "720",
  look: "editorial",
  transition: "fade",
  motion: "gentle",
  showFacts: true,
  showQr: true,
  clips: [],
  music: null,
  voiceover: null,
  brandLabel: "Refuge de Morée",
  ctaText: "Contactez le refuge pour une rencontre",
  accentColor: "#f4ab70",
  showLogo: true,
  showProgress: true,
  introSeconds: 2,
  outroSeconds: 2,
  outroSubtitle: "",
  narrationMode: "auto",
};
export default function Studio({
  initial,
  user,
  canEdit,
  notify,
  open,
  overview,
}) {
  const baseFilm = {
    ...emptyFilm,
    title:
      overview?.interface.textDefaults?.title?.slice(0, 120) || emptyFilm.title,
    ctaText:
      overview?.interface.textDefaults?.invitation?.slice(0, 100) ||
      emptyFilm.ctaText,
    outroSubtitle:
      overview?.interface.textDefaults?.signature?.slice(0, 100) ||
      "© Gaerisson",
    subtitle: overview?.interface.textDefaults?.subtitle?.slice(0, 160) || "",
    outro: overview?.interface.textDefaults?.conclusion?.slice(0, 120) || "",
    accentColor: overview?.interface.accentColor || emptyFilm.accentColor,
    brandLabel: overview?.refugeName || emptyFilm.brandLabel,
  };
  const [trash, setTrash] = useState({ projects: [], renders: [] });
  const [film, rawSetFilm] = useState(baseFilm),
    [projectId, setProjectId] = useState(null),
    [projects, setProjects] = useState([]),
    [assets, setAssets] = useState([]),
    [animals, setAnimals] = useState([]),
    [photos, setPhotos] = useState([]),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [status, setStatus] = useState(null),
    [renders, setRenders] = useState([]),
    [pollId, setPollId] = useState(null),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [year, setYear] = useState(new Date().getFullYear()),
    [selected, setSelected] = useState(null),
    [settingsTab, setSettingsTab] = useState(
      initial?.voice ? "audio" : "style",
    ),
    [player, setPlayer] = useState(null),
    [previewPending, setPreviewPending] = useState(false);
  const narrationAsset = assets.find(
    (asset) => asset.id === film.voiceover?.assetId,
  );
  const timedFilm = {
    ...film,
    voiceover: narrationAsset
      ? { ...film.voiceover, duration: narrationAsset.duration }
      : film.voiceover,
  };
  const autoTiming = !!narrationFrames(timedFilm);
  const narrationOverrun =
    film.narrationMode === "manual" &&
    narrationAsset &&
    film.voiceover.start + narrationAsset.duration > filmDuration(film) / FPS;
  const undo = useRef([]),
    redo = useRef([]);
  const setFilm = (next) =>
    rawSetFilm((prev) => {
      const n = typeof next === "function" ? next(prev) : next;
      if (JSON.stringify(n) === JSON.stringify(prev)) return prev;
      undo.current.push(prev);
      if (undo.current.length > 40) undo.current.shift();
      redo.current = [];
      return n;
    });
  const history = (direction) =>
    rawSetFilm((prev) => {
      const from = direction === "undo" ? undo : redo,
        to = direction === "undo" ? redo : undo;
      const n = from.current.pop();
      if (!n) return prev;
      to.current.push(prev);
      return n;
    });
  const presets = [
    {
      id: "editorial",
      name: "Portrait éditorial",
      description: "Photo entière · fiche lisible",
      look: "editorial",
      aspect: "landscape",
      transition: "fade",
      motion: "gentle",
      seconds: 5,
      showFacts: true,
    },
    {
      id: "story",
      name: "Story adoption",
      description: "9:16 · rythme social",
      look: "story",
      aspect: "portrait",
      transition: "wipe",
      motion: "lively",
      seconds: 3.5,
      showFacts: true,
    },
    {
      id: "cinema",
      name: "Cinéma",
      description: "Images plein écran · mouvement doux",
      look: "cinema",
      aspect: "landscape",
      transition: "fade",
      motion: "gentle",
      seconds: 6,
      showFacts: false,
    },
    {
      id: "minimal",
      name: "SOS / portrait",
      description: "9:16 · cartouche minimal",
      look: "minimal",
      aspect: "portrait",
      transition: "slide",
      motion: "lively",
      seconds: 4,
      showFacts: true,
    },
  ];
  const applyPreset = (p) =>
    setFilm((f) => ({
      ...f,
      look: p.look,
      aspect: p.aspect,
      transition: p.transition,
      motion: p.motion,
      showFacts: p.showFacts,
      clips: f.clips.map((c) =>
        c.kind === "photo" || c.kind === "spa"
          ? {
              ...c,
              seconds: p.seconds,
              fit: p.look === "editorial" ? "contain" : "cover",
            }
          : c,
      ),
    }));
  const [mediaFiles, setMediaFiles] = useState([]),
    [mediaProgress, setMediaProgress] = useState(0);
  const uploadRef = useRef();
  useEffect(() => {
    setSelected((previous) =>
      film.clips.some((clip, i) => (clip.id || i) === previous)
        ? previous
        : film.clips[0]?.id || (film.clips.length ? 0 : null),
    );
  }, [film.clips]);
  const refresh = () =>
    Promise.all([
      api("/video/projects"),
      api("/video/assets"),
      api("/video/status"),
      api("/video/renders"),
      api("/video/trash"),
    ]).then(([p, a, s, r, t]) => {
      setTrash(t);
      setProjects(p);
      setAssets(a);
      setStatus(s);
      setRenders(r);
    });
  const uploadMedia = async (file) => {
    if (!file || !canEdit || busy) return;
    setMediaFiles([file]);
    setMediaProgress(0);
    setBusy("upload");
    try {
      const kind = /\.(mp3|wav|m4a)$/i.test(file.name) ? "audio" : "video",
        form = new FormData();
      form.append("file", file);
      await uploadWithProgress(
        "/video/assets?kind=" + kind,
        form,
        setMediaProgress,
      );
      await refresh();
      setMediaFiles([]);
      notify("Média ajouté au studio.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy("");
    }
  };
  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timer = setTimeout(
      () =>
        api(
          "/animals?limit=24&page=" + page + "&q=" + encodeURIComponent(query),
        )
          .then((data) => {
            if (!cancelled) {
              setAnimals(data.items);
              setPages(data.pages);
            }
          })
          .catch((e) => setError(e.message)),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id, page, query]);
  useEffect(() => {
    setPage(1);
  }, [query]);
  const chooseAnimal = async (id) => {
    try {
      const a = await api("/animals/" + id);
      setPhotos([
        ...a.photos
          .filter((p) => !p.archived_at)
          .map((p) => ({ ...p, animal_name: a.name })),
        ...(a.source_metadata?.thumbnail
          ? [
              {
                id: a.id,
                spa: true,
                animal_name: a.name,
                filename: "Référence du site SPA",
              },
            ]
          : []),
      ]);
      return a;
    } catch (e) {
      notify(e.message, "error");
    }
  };
  useEffect(() => {
    if (!user || !initial?.animalId) return;
    chooseAnimal(initial.animalId).then((a) => {
      if (a) {
        setFilm({
          ...baseFilm,
          title:
            a.name +
            " · " +
            (overview?.interface.textDefaults?.title ||
              "Une nouvelle rencontre"),
          clips: (a.photos.some((p) => !p.archived_at)
            ? a.photos
            : [
                ...(a.source_metadata?.thumbnail
                  ? [{ id: a.id, spa: true }]
                  : []),
              ]
          )
            .filter((p) => !p.archived_at)
            .slice(0, 12)
            .map((p, i) => ({
              id: uid(),
              kind: p.spa ? "spa" : "photo",
              ref: p.id,
              seconds: 4,
              trim: 0,
              title: a.name,
              subtitle: speciesName[a.species],
              caption: i === 0 ? a.description.slice(0, 200) : "",
              fit: "contain",
              muted: true,
            })),
        });
        setProjectId(null);
      }
    });
  }, [initial?.animalId, user?.id]);
  useEffect(() => {
    if (initial?.year) setYear(initial.year);
  }, [initial?.year]);
  useEffect(() => {
    if (!user || !film.clips.length) {
      setPreview(null);
      setPreviewPending(false);
      setError("");
      return;
    }
    let cancelled = false;
    setPreviewPending(true);
    const timer = setTimeout(
      () =>
        api("/video/preview", { method: "POST", body: film })
          .then((data) => {
            if (!cancelled) {
              setPreview(data);
              setError("");
              setPreviewPending(false);
            }
          })
          .catch((e) => {
            if (!cancelled) {
              setError(e.message);
              setPreviewPending(false);
            }
          }),
      350,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [film, user?.id]);
  useEffect(() => {
    if (!pollId) return;
    const timer = setInterval(
      () =>
        api("/video/renders")
          .then((rows) => {
            setRenders(rows);
            const render = rows.find((r) => r.id === pollId);
            if (render && render.state !== "running") {
              setPollId(null);
              notify(
                render.state === "done"
                  ? "Votre vidéo est prête."
                  : render.error,
                render.state === "done" ? "success" : "error",
              );
            }
          })
          .catch(() => {}),
      2000,
    );
    return () => clearInterval(timer);
  }, [pollId]);
  if (!user)
    return (
      <Empty
        icon={Video}
        title="Studio vidéo"
        text="Connectez-vous pour créer un film et télécharger les vidéos de l’équipe."
        action={
          <Button onClick={() => open({ type: "login" })}>Se connecter</Button>
        }
      />
    );
  const update = (key, value) => setFilm((f) => ({ ...f, [key]: value }));
  const addPhoto = (photo) => {
    if (film.clips.length >= 100) {
      notify("100 plans maximum par projet.", "error");
      return;
    }
    setFilm((f) => ({
      ...f,
      clips: [
        ...f.clips,
        {
          id: uid(),
          kind: photo.spa ? "spa" : "photo",
          ref: photo.id,
          seconds: 4,
          trim: 0,
          title: photo.animal_name || "",
          subtitle: "",
          caption: "",
          fit: "cover",
          muted: true,
        },
      ],
    }));
  };
  const addVideo = (asset) => {
    if (film.template === "year" && film.annualStyle === "mosaic") {
      notify(
        "Pour ajouter un clip vidéo, passez le bilan en diaporama classique.",
        "error",
      );
      return;
    }
    if (film.clips.length >= 100) {
      notify("100 plans maximum par projet.", "error");
      return;
    }
    if (asset.duration < 1) {
      notify("Ce clip est trop court pour un plan de 1 seconde.", "error");
      return;
    }
    setFilm((f) => ({
      ...f,
      clips: [
        ...f.clips,
        {
          id: uid(),
          kind: "video",
          ref: asset.id,
          seconds: Math.min(6, Math.floor(asset.duration * 2) / 2),
          trim: 0,
          title: "",
          subtitle: "",
          caption: "",
          fit: "cover",
          muted: true,
        },
      ],
    }));
  };
  const patchClip = (index, body) =>
    setFilm((f) => ({
      ...f,
      clips: f.clips.map((c, i) => (i === index ? { ...c, ...body } : c)),
    }));
  const move = (index, to) =>
    canEdit &&
    setFilm((f) => ({ ...f, clips: moveFilmClip(f.clips, index, to) }));
  const duplicate = (index) => {
    if (!canEdit || film.clips.length >= 100) return;
    const copyId = uid();
    update(
      "clips",
      film.clips.flatMap((clip, i) =>
        i === index ? [clip, { ...clip, id: copyId }] : [clip],
      ),
    );
    setSelected(copyId);
  };
  const remove = (index) =>
    canEdit &&
    update(
      "clips",
      film.clips.filter((_, i) => i !== index),
    );
  const save = async () => {
    if (!canEdit) return;
    const result = await api(
      "/video/projects" + (projectId ? "/" + projectId : ""),
      { method: projectId ? "PUT" : "POST", body: film },
    );
    setProjectId(result.id);
    await refresh();
    return result.id;
  };

  return (
    <div className="studio314">
      <div className="page-heading">
        <div>
          <div className="eyebrow">L’ATELIER DES BELLES HISTOIRES</div>
          <h1>Le studio vidéo</h1>
          <p>Des images, une voix, une belle rencontre. À vous de jouer.</p>
        </div>
        <span className="cut-header-tag">VOTRE ATELIER CRÉATIF</span>
      </div>
      <div className="studio-projectbar">
        <select
          aria-label="Ouvrir un projet vidéo"
          value={projectId || ""}
          onChange={async (e) => {
            if (!e.target.value) {
              setProjectId(null);
              setFilm(baseFilm);
              return;
            }
            try {
              const project = await api("/video/projects/" + e.target.value);
              setProjectId(project.id);
              setFilm(project.config);
            } catch (error) {
              notify(error.message, "error");
            }
          }}
        >
          <option value="">Nouveau projet</option>
          {projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <AnnualPicker
          year={year}
          setYear={setYear}
          disabled={!canEdit || !!busy}
          notify={notify}
          base={baseFilm}
          accent={overview?.interface.accentColor}
          onCreate={(next) => {
            setFilm(next);
            setProjectId(null);
            notify("Bilan préparé avec les animaux sélectionnés.");
          }}
        />
        {projectId && canEdit && (
          <Button
            variant="quiet"
            icon={Trash2}
            onClick={async () => {
              try {
                await api(`/video/projects/${projectId}`, { method: "DELETE" });
                setProjectId(null);
                setFilm(baseFilm);
                await refresh();
                notify("Projet déplacé dans la corbeille.");
              } catch (e) {
                notify(e.message, "error");
              }
            }}
          >
            Supprimer le projet
          </Button>
        )}
        {projectId && film.music && (
          <a
            className="text-link"
            href={`/api/video/projects/${projectId}/credits`}
          >
            Crédits musique ↗
          </a>
        )}
      </div>
      <div className="cut-workflow">
        <a
          href="#studio-media"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("studio-media")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <span>1</span> Choisir les images
        </a>
        <button onClick={() => setSettingsTab("style")}>
          <span>2</span> Donner le ton
        </button>
        <button onClick={() => setSettingsTab("audio")}>
          <span>3</span> Ajouter une voix
        </button>
        <span className="cut-workflow-end">4 · Exporter votre histoire</span>
      </div>
      <div className="studio-history">
        <Button
          variant="secondary"
          disabled={!canEdit || !undo.current.length}
          onClick={() => history("undo")}
        >
          Annuler
        </Button>
        <Button
          variant="secondary"
          disabled={!canEdit || !redo.current.length}
          onClick={() => history("redo")}
        >
          Rétablir
        </Button>
      </div>
      <div className="studio-layout">
        <section className="studio-screen">
          <div className="player-surface">
            {preview ? (
              <ImageReady
                urls={preview.clips
                  .filter((c) => c.kind === "photo" || c.kind === "spa")
                  .map((c) => c.src)}
              >
                <Player
                  ref={setPlayer}
                  key={film.aspect + "-" + film.resolution}
                  component={AnimalFilm}
                  inputProps={{ film: preview }}
                  durationInFrames={filmDuration(preview)}
                  compositionWidth={
                    dimensions(film.aspect, film.resolution).width
                  }
                  compositionHeight={
                    dimensions(film.aspect, film.resolution).height
                  }
                  fps={FPS}
                  initialFrame={FPS}
                  controls
                  style={{
                    width: "100%",
                    maxHeight: 550,
                    aspectRatio: `${dimensions(film.aspect, film.resolution).width}/${dimensions(film.aspect, film.resolution).height}`,
                  }}
                />
              </ImageReady>
            ) : (
              <div className="player-empty">
                <Film size={54} />
                <h2>Aucun plan dans le montage</h2>
                <p>
                  {error ||
                    "Ajoutez une première photo ou un clip à la timeline."}
                </p>
              </div>
            )}
          </div>
          {error && (
            <p className="error-text cut-preview-notice" role="alert">
              {error}
            </p>
          )}
          {previewPending && film.clips.length > 0 && (
            <p className="cut-preview-notice" role="status">
              Mise à jour de l’aperçu…
            </p>
          )}
          <div className="studio-measures">
            <span>
              {film.clips.length} plans · {filmTime(filmDuration(timedFilm))}
            </span>
            <span>
              ≈{" "}
              {bytes(
                ((filmDuration(timedFilm) / FPS) *
                  (4_000_000 + (film.music ? 128000 : 0))) /
                  8,
              )}{" "}
              à 4 Mbit/s
            </span>
          </div>
          <div className="studio-actions">
            <Button
              icon={Save}
              variant="secondary"
              disabled={
                !canEdit || !!busy || !preview || !!error || previewPending
              }
              onClick={async () => {
                setBusy("save");
                try {
                  await save();
                  notify("Projet enregistré.");
                } catch (e) {
                  notify(e.message, "error");
                } finally {
                  setBusy("");
                }
              }}
            >
              Enregistrer
            </Button>
            <Button
              icon={busy === "render" ? LoaderCircle : Video}
              disabled={
                !canEdit ||
                !!busy ||
                !preview ||
                previewPending ||
                !!error ||
                !status?.enabled ||
                !status?.browser ||
                !status?.bundle ||
                !!pollId
              }
              onClick={async () => {
                setBusy("render");
                try {
                  const id = await save();
                  const result = await api(
                    "/video/projects/" + id + "/render",
                    { method: "POST" },
                  );
                  setPollId(result.renderId);
                  notify(
                    "Le rendu a démarré. Vous pouvez continuer à parcourir le site.",
                  );
                  await refresh();
                } catch (e) {
                  notify(e.message, "error");
                } finally {
                  setBusy("");
                }
              }}
            >
              {pollId ? "Rendu en cours…" : "Exporter en MP4"}
            </Button>
          </div>
          {status && (!status.browser || !status.bundle) && (
            <div className="notice compact">
              Préparation serveur :{" "}
              {!status.browser && <code>npm run video:browser</code>}{" "}
              {!status.bundle && <code>npm run video:build</code>}
            </div>
          )}
          <StudioTimeline
            film={timedFilm}
            player={player}
            selected={selected}
            canEdit={canEdit}
            onSelect={(index) => {
              setSelected(film.clips[index].id || index);
              setSettingsTab("plan");
            }}
            onMove={move}
            onAudio={() => setSettingsTab("audio")}
          />
        </section>
        <section className="panel studio-settings">
          <div
            className="cut-settings-tabs"
            role="tablist"
            aria-label="Réglages du montage"
          >
            {[
              ["plan", "Le plan"],
              ["style", "Ambiance"],
              ["audio", "Voix & son"],
            ].map(([key, label], i) => (
              <button
                key={key}
                id={`studio-tab-${key}`}
                role="tab"
                aria-selected={settingsTab === key}
                aria-controls={`studio-panel-${key}`}
                tabIndex={settingsTab === key ? 0 : -1}
                onClick={() => setSettingsTab(key)}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const keys = ["plan", "style", "audio"];
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 2
                          : (i + (e.key === "ArrowLeft" ? 2 : 1)) % 3;
                    setSettingsTab(keys[next]);
                    e.currentTarget.parentElement.children[next].focus();
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cut-settings-body">
            <div
              role="tabpanel"
              id="studio-panel-plan"
              aria-labelledby="studio-tab-plan"
              hidden={settingsTab !== "plan"}
            >
              <StudioClipInspector
                film={film}
                selected={selected}
                assets={assets}
                canEdit={canEdit}
                patch={patchClip}
                move={move}
                duplicate={duplicate}
                remove={remove}
                auto={autoTiming}
              />
            </div>
            <div
              className="form-stack"
              role="tabpanel"
              id="studio-panel-style"
              aria-labelledby="studio-tab-style"
              hidden={settingsTab !== "style"}
            >
              <h2>Donnez le ton</h2>{" "}
              <div className="studio-preset-grid">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    className={film.look === p.look ? "selected" : ""}
                    aria-pressed={film.look === p.look}
                    disabled={!canEdit}
                    onClick={() => applyPreset(p)}
                  >
                    <strong>{p.name}</strong>
                    <small>{p.description}</small>
                  </button>
                ))}
              </div>
              {film.template === "year" && (
                <>
                  <label className="annual-inline-total">
                    <span>
                      Adoptions affichées
                      <small>
                        Personnalisé pour cette vidéo. Vide : statistiques du
                        refuge.
                      </small>
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      value={film.annualAdoptionsOverride ?? ""}
                      placeholder="Automatique"
                      onChange={(e) =>
                        update(
                          "annualAdoptionsOverride",
                          e.target.value === ""
                            ? null
                            : Math.max(
                                0,
                                Math.min(
                                  1000000,
                                  Math.round(Number(e.target.value)),
                                ),
                              ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Animation du bilan
                    <select
                      value={film.annualStyle || "slideshow"}
                      onChange={(e) => update("annualStyle", e.target.value)}
                    >
                      <option value="mosaic">Portraits → logo SPA</option>
                      <option value="slideshow">Diaporama classique</option>
                    </select>
                  </label>
                  <label>
                    Message de fin
                    <input
                      value={film.annualMessage || ""}
                      maxLength={120}
                      disabled={!canEdit}
                      placeholder={`Bonne année ${Number(film.year || year) + 1}`}
                      onChange={(e) =>
                        setFilm((f) => ({
                          ...f,
                          annualMessage: e.target.value,
                          outro:
                            e.target.value ||
                            "Merci à toute l’équipe et aux familles.",
                        }))
                      }
                    />
                  </label>
                  <label>
                    Sous-texte du message
                    <input
                      value={film.annualMessageSubtitle || ""}
                      maxLength={180}
                      disabled={!canEdit}
                      placeholder="Merci aux familles, bénévoles et agents du refuge"
                      onChange={(e) =>
                        update("annualMessageSubtitle", e.target.value)
                      }
                    />
                  </label>
                  <div className="annual-message-presets">
                    {[
                      `Bonne année ${Number(film.year || year) + 1}`,
                      "Merci pour toutes ces belles rencontres",
                      "Une nouvelle année, de nouvelles histoires",
                    ].map((text) => (
                      <button
                        type="button"
                        key={text}
                        disabled={!canEdit}
                        onClick={() =>
                          setFilm((f) => ({
                            ...f,
                            annualMessage: text,
                            outro: text,
                          }))
                        }
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={film.annualSidePhotos !== false}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update("annualSidePhotos", e.target.checked)
                      }
                    />
                    Bandes de photos animées
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={film.annualStats !== false}
                      disabled={!canEdit}
                      onChange={(e) => update("annualStats", e.target.checked)}
                    />
                    Statistiques à la fin
                  </label>
                  <AnnualStatistics
                    year={Number(film.year) || new Date().getFullYear()}
                    user={user}
                    notify={notify}
                    onSaved={() => setFilm((f) => ({ ...f }))}
                  />
                  <label>
                    Animation finale du logo
                    <select
                      disabled={!canEdit}
                      value={film.logoAnimation || "fade"}
                      onChange={(e) => update("logoAnimation", e.target.value)}
                    >
                      {Object.entries(logoAnimations).map(([id, n]) => (
                        <option key={id} value={id}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ambiance du fond
                    <select
                      disabled={!canEdit}
                      value={film.backgroundTheme || "classic"}
                      onChange={(e) =>
                        update("backgroundTheme", e.target.value)
                      }
                    >
                      <option value="auto">Selon la saison</option>
                      {Object.entries(visualThemes).map(([id, t]) => (
                        <option key={id} value={id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Particules
                    <select
                      disabled={!canEdit}
                      value={film.particleStyle || "auto"}
                      onChange={(e) => update("particleStyle", e.target.value)}
                    >
                      {Object.entries(particleStyles).map(([id, n]) => (
                        <option key={id} value={id}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Densité · {film.particleDensity ?? 35}%
                    <input
                      disabled={!canEdit}
                      type="range"
                      min="0"
                      max="100"
                      value={film.particleDensity ?? 35}
                      onChange={(e) =>
                        update("particleDensity", +e.target.value)
                      }
                    />
                  </label>
                </>
              )}
              <div className="form-row">
                <label>
                  Transition
                  <select
                    value={film.transition || "fade"}
                    disabled={!canEdit}
                    onChange={(e) => update("transition", e.target.value)}
                  >
                    <option value="fade">Fondu croisé</option>
                    <option value="slide">Glissement</option>
                    <option value="wipe">Révélation</option>
                  </select>
                </label>
                <label>
                  Animation
                  <select
                    value={film.motion || "gentle"}
                    disabled={!canEdit}
                    onChange={(e) => update("motion", e.target.value)}
                  >
                    <option value="gentle">Douce</option>
                    <option value="lively">Dynamique</option>
                    <option value="off">Sans mouvement</option>
                  </select>
                </label>
              </div>
              <label className="video-facts-toggle">
                <input
                  type="checkbox"
                  checked={film.showFacts !== false}
                  disabled={!canEdit}
                  onChange={(e) => update("showFacts", e.target.checked)}
                />
                Afficher les informations SPA
              </label>
              <label>
                Titre du film
                <input
                  value={film.title}
                  maxLength={120}
                  disabled={!canEdit}
                  onChange={(e) => update("title", e.target.value)}
                />
              </label>
              <label>
                Sous-titre
                <input
                  value={film.subtitle}
                  maxLength={160}
                  disabled={!canEdit}
                  onChange={(e) => update("subtitle", e.target.value)}
                />
              </label>
              <div className="form-row">
                <label>
                  Format
                  <select
                    value={film.aspect}
                    disabled={!canEdit}
                    onChange={(e) => update("aspect", e.target.value)}
                  >
                    <option value="landscape">Paysage · 16:9</option>
                    <option value="portrait">Portrait · 9:16</option>
                    <option value="square">Carré · 1:1</option>
                  </select>
                </label>
                <label>
                  Résolution
                  <select
                    value={film.resolution}
                    disabled={!canEdit}
                    onChange={(e) => update("resolution", e.target.value)}
                  >
                    <option value="720">720p</option>
                    <option value="1080">1080p</option>
                  </select>
                </label>
              </div>
              <label>
                Conclusion
                <input
                  value={film.outro}
                  maxLength={120}
                  disabled={!canEdit}
                  onChange={(e) => update("outro", e.target.value)}
                />
              </label>
              <details className="video-advanced">
                <summary>Identité, cadrage et séquences</summary>
                <label>
                  Signature du refuge
                  <input
                    maxLength="100"
                    value={film.brandLabel || ""}
                    disabled={!canEdit}
                    onChange={(e) => update("brandLabel", e.target.value)}
                  />
                </label>
                <label>
                  Invitation finale
                  <input
                    maxLength="100"
                    value={film.ctaText || ""}
                    disabled={!canEdit}
                    onChange={(e) => update("ctaText", e.target.value)}
                  />
                </label>
                <label>
                  Couleur
                  <input
                    type="color"
                    value={film.accentColor || "#f4ab70"}
                    disabled={!canEdit}
                    onChange={(e) => update("accentColor", e.target.value)}
                  />
                </label>
                <div className="form-row">
                  {[
                    ["introSeconds", "Introduction"],
                    ["outroSeconds", "Conclusion"],
                  ].map(([k, label]) => (
                    <label key={k}>
                      {label} (s)
                      <input
                        type="number"
                        min="0"
                        max="8"
                        step=".5"
                        value={film[k] ?? 2}
                        disabled={!canEdit}
                        onChange={(e) => update(k, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={film.showLogo !== false}
                    disabled={!canEdit}
                    onChange={(e) => update("showLogo", e.target.checked)}
                  />
                  Logo SPA
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={film.showProgress !== false}
                    disabled={!canEdit}
                    onChange={(e) => update("showProgress", e.target.checked)}
                  />
                  Progression dans le plan
                </label>
              </details>{" "}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={film.showQr !== false}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setFilm({ ...film, showQr: e.target.checked })
                  }
                />
                Afficher le QR SPA dans les portraits
              </label>
            </div>
            <div
              className="form-stack"
              role="tabpanel"
              id="studio-panel-audio"
              aria-labelledby="studio-tab-audio"
              hidden={settingsTab !== "audio"}
            >
              <h2>Le son de votre histoire</h2>
              <label>
                Piste voix existante
                <select
                  value={film.voiceover?.assetId || ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setFilm((current) => ({
                      ...current,
                      narrationMode: "auto",
                      voiceover: e.target.value
                        ? { assetId: e.target.value, volume: 1, start: 0 }
                        : null,
                    }))
                  }
                >
                  <option value="">Choisir un fichier audio importé…</option>
                  {assets
                    .filter((asset) => asset.kind === "audio")
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.filename} · {asset.duration.toFixed(1)} s
                      </option>
                    ))}
                </select>
              </label>
              <VoicePanel
                initialOpen={settingsTab === "audio" || !!initial?.voice}
                film={film}
                canEdit={canEdit}
                notify={notify}
                onTextChange={(text) => update("narrationText", text)}
                onAdd={async (asset) => {
                  setFilm((current) => ({
                    ...current,
                    narrationMode: "auto",
                    voiceover: { assetId: asset.id, volume: 1, start: 0 },
                  }));
                  setAssets((current) => [
                    ...current.filter((a) => a.id !== asset.id),
                    asset,
                  ]);
                  await refresh();
                }}
              />
              <SubtitlePanel
                film={film}
                assets={assets}
                canEdit={canEdit}
                notify={notify}
                update={update}
                duration={filmDuration(timedFilm) / FPS}
              />
              {film.voiceover && (
                <div className="voice-mix">
                  {narrationAsset && (
                    <p className="fineprint">
                      Voix : {narrationAsset.duration.toFixed(1)} s · montage :{" "}
                      {(filmDuration(timedFilm) / FPS).toFixed(1)} s
                    </p>
                  )}
                  <label className="cut-auto-toggle checkbox-label">
                    <input
                      type="checkbox"
                      checked={film.narrationMode !== "manual"}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(
                          "narrationMode",
                          e.target.checked ? "auto" : "manual",
                        )
                      }
                    />
                    Caler la vidéo sur la durée de la voix
                  </label>
                  <p className="fineprint">
                    {autoTiming
                      ? "Photos, reprises, introduction et conclusion s’adaptent automatiquement. La voix reste entière."
                      : "Durée libre : vous choisissez la durée de chaque plan."}
                  </p>
                  {narrationOverrun && (
                    <p className="error-text" role="status">
                      La voix dépasse la vidéo. Activez le calage automatique
                      pour l’exporter en entier.
                    </p>
                  )}
                  <label>
                    Volume voix · {Math.round(film.voiceover.volume * 100)}%
                    <input
                      aria-label="Volume de la voix off"
                      disabled={!canEdit}
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={film.voiceover.volume}
                      onChange={(e) =>
                        update("voiceover", {
                          ...film.voiceover,
                          volume: +e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Début de la voix (s)
                    <input
                      disabled={!canEdit}
                      type="number"
                      min="0"
                      max={Math.max(0, 600 - (narrationAsset?.duration || 1))}
                      step=".5"
                      value={film.voiceover.start}
                      onChange={(e) =>
                        update("voiceover", {
                          ...film.voiceover,
                          start: +e.target.value,
                        })
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="quiet"
                    disabled={!canEdit}
                    onClick={() => update("voiceover", null)}
                  >
                    Retirer la voix
                  </Button>
                </div>
              )}
              <label>
                Musique
                <select
                  value={film.music?.assetId || ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    update(
                      "music",
                      e.target.value
                        ? { assetId: e.target.value, volume: 0.25 }
                        : null,
                    )
                  }
                >
                  <option value="">Sans musique</option>
                  {assets
                    .filter((a) => a.kind === "audio")
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.filename}
                      </option>
                    ))}
                </select>
              </label>
              {film.music && (
                <label>
                  Volume : {Math.round(film.music.volume * 100)}%
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={film.music.volume}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update("music", {
                        ...film.music,
                        volume: Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}

              <small>
                La musique boucle avec un fondu. Utilisez des contenus dont vous
                disposez des droits.
              </small>
            </div>
          </div>
        </section>
      </div>
      <div className="cut-media-heading" id="studio-media">
        <div>
          <span className="eyebrow">VOTRE MÉDIATHÈQUE</span>
          <h2>Les images qui racontent</h2>
        </div>
        <span>Choisissez un album, puis les photos à ajouter.</span>
      </div>
      <div className="studio-bank">
        <section className="panel">
          <div className="panel-heading">
            <h2>Les photos du refuge</h2>
            <Image size={22} />
          </div>
          <input
            aria-label="Rechercher un album pour la vidéo"
            placeholder="Rechercher un animal…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="album-chips">
            {animals.map((a) => (
              <button key={a.id} onClick={() => chooseAnimal(a.id)}>
                {a.name}
                <small>{a.photo_count} photos</small>
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Précédent
              </button>
              <span>
                {page}/{pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </button>
            </div>
          )}
          {photos.length > 0 && (
            <Button
              variant="secondary"
              icon={Plus}
              disabled={!canEdit || film.clips.length + photos.length > 100}
              onClick={() =>
                setFilm((current) => ({
                  ...current,
                  clips: [
                    ...current.clips,
                    ...photos.map((photo) => ({
                      id: uid(),
                      kind: photo.spa ? "spa" : "photo",
                      ref: photo.id,
                      seconds: 4,
                      trim: 0,
                      title: photo.animal_name || "",
                      subtitle: "",
                      caption: "",
                      fit: "cover",
                      muted: true,
                    })),
                  ],
                }))
              }
            >
              Ajouter tout l’album · {photos.length} photos
            </Button>
          )}
          <div className="media-bank">
            {photos.map((p) => (
              <button
                key={p.id}
                disabled={!canEdit}
                onClick={() => addPhoto(p)}
              >
                <img
                  src={
                    p.spa
                      ? `/api/animals/${p.id}/source-photo?w=320`
                      : imageUrl(p.id, 320)
                  }
                  alt={"Ajouter " + p.filename}
                />
                {p.spa && <small className="source-origin-chip">SPA</small>}
                <Plus size={18} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Clips & musique</h2>
            <Button
              icon={Upload}
              variant="secondary"
              disabled={!canEdit || !!busy}
              onClick={() => uploadRef.current.click()}
            >
              Importer
            </Button>
            <input
              ref={uploadRef}
              hidden
              type="file"
              accept=".mp4,.webm,.mp3,.wav,.m4a"
              onChange={(e) => {
                const file = e.target.files[0];
                e.target.value = "";
                uploadMedia(file);
              }}
            />
          </div>
          <p>
            MP4/WebM pour la vidéo · MP3/WAV/M4A pour le son · limite serveur
            configurable (512 Mo par défaut) par fichier.
          </p>
          {canEdit && (
            <DropArea
              disabled={!!busy}
              onFiles={(files) => uploadMedia(files[0])}
            />
          )}
          <UploadPreviews
            files={mediaFiles}
            busy={busy === "upload"}
            progress={mediaProgress}
          />
          <MusicCatalog
            canEdit={canEdit}
            notify={notify}
            onImport={async (assetId) => {
              await refresh();
              update("music", { assetId, volume: 0.25 });
            }}
          />
          <div className="asset-list">
            {assets.map((asset) => (
              <div key={asset.id}>
                {asset.kind === "audio" ? (
                  <Music size={20} />
                ) : (
                  <Video size={20} />
                )}
                <span>
                  <strong>{asset.filename}</strong>
                  <small>
                    {Math.round(asset.duration)}s · {bytes(asset.size)}
                  </small>
                </span>
                <button
                  disabled={!canEdit}
                  aria-label={"Ajouter " + asset.filename}
                  onClick={() =>
                    asset.kind === "audio"
                      ? update("music", { assetId: asset.id, volume: 0.25 })
                      : addVideo(asset)
                  }
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Les films de l’équipe</h2>
          <Video size={22} />
        </div>
        {!renders.length ? (
          <p className="muted">Les premiers exports apparaîtront ici.</p>
        ) : (
          <div className="render-list">
            {renders.map((render) => {
              let progress = 0;
              try {
                progress = JSON.parse(render.progress || "{}").progress || 0;
              } catch {}
              return (
                <div key={render.id}>
                  <Video size={24} />
                  <span>
                    <strong>{render.title}</strong>
                    <small>
                      {date(render.created_at)} ·{" "}
                      {render.state === "done"
                        ? bytes(render.size)
                        : render.state === "running"
                          ? progress + "%"
                          : render.error}
                    </small>
                    {render.state === "running" && (
                      <progress value={progress} max={100} />
                    )}
                  </span>
                  {canEdit && render.state !== "running" && (
                    <button
                      className="icon-button"
                      aria-label={`Supprimer l’export ${render.title}`}
                      onClick={async () => {
                        try {
                          await api(`/video/renders/${render.id}`, {
                            method: "DELETE",
                          });
                          await refresh();
                          notify("Export déplacé dans la corbeille.");
                        } catch (e) {
                          notify(e.message, "error");
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                  {render.state === "done" ? (
                    <a
                      className="button secondary"
                      href={"/api/video/renders/" + render.id + "/download"}
                    >
                      <Download size={16} />
                      MP4
                    </a>
                  ) : render.state === "running" && canEdit ? (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        api("/video/renders/" + render.id + "/cancel", {
                          method: "POST",
                        })
                          .then(() => notify("Annulation demandée."))
                          .catch((e) => notify(e.message, "error"))
                      }
                    >
                      Annuler
                    </Button>
                  ) : (
                    <span className="tag sand">À relancer</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <StudioTrash
        trash={trash}
        canEdit={canEdit}
        refresh={refresh}
        notify={notify}
      />
    </div>
  );
}
