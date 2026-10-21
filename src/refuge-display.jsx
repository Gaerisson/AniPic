import { Component, useEffect, useState } from "react";
import { Monitor, ExternalLink, Save, Film, Settings2 } from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
import { ShowPlayer } from "./show-player.jsx";
import { ShowOptions, MotionExports } from "./show-options.jsx";
import { ShowTimeline } from "./show-timeline.jsx";
import { copyText } from "./api.js";
import { showDefaults } from "../shared/signage.mjs";
import {
  useDisplayMonitor,
  DisplayMonitorControl,
} from "./use-display-monitor.jsx";
import { DisplayScreens } from "./display-screens.jsx";
class TVPlaybackBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onStatus({
      state: "error",
      scene: null,
      issues: ["render_error"],
    });
  }
  render() {
    return this.state.failed ? (
      <div className="show-loading">
        <p>La lecture a été interrompue.</p>
        <Button onClick={() => this.setState({ failed: false })}>
          Réessayer
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function RefugeScreen() {
  const monitor = useDisplayMonitor();
  const [recovery, setRecovery] = useState(0);
  const [show, setShow] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const load = () =>
      api("/public/display")
        .then((d) => {
          if (alive) {
            monitor.sync(d);
            setShow(d);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) {
            setError(e.message);
            if (e.code === "MODULE_DISABLED" || e.code === "SITE_PIN_REQUIRED")
              setShow((s) => (s ? { ...s, enabled: false } : null));
            monitor.failed();
          }
        });
    load();
    const refresh = () => load();
    const timer = setInterval(
      load,
      (monitor.config?.refreshSeconds || 60) * 1000,
    );
    window.addEventListener("online", refresh);
    window.addEventListener("anipic-tv-refresh", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("anipic-tv-refresh", refresh);
    };
  }, [monitor.config?.refreshSeconds]);
  useEffect(() => {
    if (!monitor.config?.autoReconnect) return;
    const retry = setInterval(() => {
      if (error && navigator.onLine)
        window.dispatchEvent(new Event("anipic-tv-refresh"));
    }, 10000);
    return () => clearInterval(retry);
  }, [error, monitor.config?.autoReconnect]);
  useEffect(() => {
    let timer;
    const report = (e) => {
      clearTimeout(timer);
      if (monitor.config?.autoReconnect && e.detail?.state === "error")
        timer = setTimeout(() => setRecovery((n) => n + 1), 15000);
    };
    window.addEventListener("anipic-tv-playback", report);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("anipic-tv-playback", report);
    };
  }, [monitor.config?.autoReconnect]);
  if (!show)
    return (
      <main className="show-loading">
        {error ? (
          <Empty icon={Monitor} title="Écran indisponible" text={error} />
        ) : (
          <Spinner />
        )}
      </main>
    );
  if (!show.enabled)
    return (
      <main className="show-loading">
        <Empty
          icon={Monitor}
          title={!show.enabled ? "Écran désactivé" : "Aucun animal sélectionné"}
          text="Configurez le programme dans Écran du refuge."
          action={
            <>
              <a href="#gallery">Retour à Anipic</a>
              <DisplayMonitorControl monitor={monitor} />
            </>
          }
        />
      </main>
    );
  return (
    <>
      <TVPlaybackBoundary
        key={show.revision + ":" + recovery}
        onStatus={monitor.onStatus}
      >
        <ShowPlayer
          full
          show={
            monitor.config
              ? {
                  ...show,
                  items: show.items.filter((a) =>
                    monitor.config.species.includes(a.species),
                  ),
                  program: {
                    ...show.program,
                    ...(monitor.config.orientation !== "inherit"
                      ? { orientation: monitor.config.orientation }
                      : {}),
                    ...(monitor.config.photoSeconds
                      ? { photoSeconds: monitor.config.photoSeconds }
                      : {}),
                    ...(monitor.config.stats !== "inherit"
                      ? { statsEnabled: monitor.config.stats === "on" }
                      : {}),
                    ...(monitor.config.showQr !== "inherit"
                      ? { showQr: monitor.config.showQr === "on" }
                      : {}),
                  },
                }
              : show
          }
          synced
          onStatus={monitor.onStatus}
          monitorControl={<DisplayMonitorControl monitor={monitor} />}
        />
      </TVPlaybackBoundary>
      {error && (
        <div className="screen-error" role="status">
          Connexion interrompue · programme conservé
        </div>
      )}
    </>
  );
}
export function DisplaySettings({ notify, user }) {
  const [cfg, setCfg] = useState(null),
    [show, setShow] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("programme"),
    [seekFrame, setSeekFrame] = useState(null),
    [monitoring, setMonitoring] = useState(false);
  useEffect(() => {
    api("/admin/display")
      .then(setCfg)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!cfg) return;
    let alive = true;
    const timer = setTimeout(
      () =>
        api("/admin/display/preview", { method: "POST", body: cfg })
          .then((v) => {
            if (alive) {
              setShow(v);
              setError("");
            }
          })
          .catch((e) => alive && setError(e.message)),
      450,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cfg]);
  const patch = (key, value) => setCfg((v) => ({ ...v, [key]: value }));
  if (!cfg) return error ? <p role="alert">{error}</p> : <Spinner />;
  const program = { ...showDefaults, ...cfg.displayProgram };
  const render = async () => {
    setBusy(true);
    try {
      await api("/motion/render", {
        method: "POST",
        body: {
          program,
          hiddenIds: cfg.displayHiddenIds,
          title: "Programme accueil",
        },
      });
      notify("Export lancé. Retrouvez-le sous l’aperçu.");
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
          <h1>Écran du refuge</h1>
          <p className="muted">Le programme de l’accueil</p>
        </div>
        <div className="heading-actions">
          <a
            className="button secondary"
            href="#display"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={17} />
            Ouvrir la TV
          </a>
          <Button
            icon={Save}
            disabled={busy || monitoring}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/admin/display", { method: "PUT", body: cfg });
                notify(
                  "Programme enregistré. La TV le recevra sous une minute.",
                );
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </div>
      </div>
      <nav className="display-view-tabs" aria-label="Écran du refuge">
        <button aria-pressed={!monitoring} onClick={() => setMonitoring(false)}>
          Programme & diffusion
        </button>
        <button aria-pressed={monitoring} onClick={() => setMonitoring(true)}>
          Suivi des TV
        </button>
      </nav>
      {monitoring ? (
        <DisplayScreens notify={notify} />
      ) : (
        <div className="signage-editor">
          <div className="signage-config panel">
            <div className="signage-tabs">
              {[
                ["programme", "Programme"],
                ["style", "Style"],
                ["diffusion", "Diffusion"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "diffusion" ? (
              <div className="show-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={cfg.displayEnabled}
                    onChange={(e) => patch("displayEnabled", e.target.checked)}
                  />
                  Activer l’écran public
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={cfg.displaySpaPhotos}
                    onChange={(e) =>
                      patch("displaySpaPhotos", e.target.checked)
                    }
                  />
                  Photos SPA en l’absence de photo locale
                </label>
                <small>
                  Les photos SPA sont signalées à l’écran. Les exports utilisent
                  les médias publics et les références SPA sélectionnées.
                </small>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={cfg.displayReserved}
                    onChange={(e) => patch("displayReserved", e.target.checked)}
                  />
                  Inclure les animaux réservés
                </label>
                <ShowOptions
                  program={program}
                  change={(v) => patch("displayProgram", v)}
                  section="schedule"
                />
                <a className="button secondary" href="#motion">
                  <Film size={17} />
                  Fonds animés & réseaux
                </a>
              </div>
            ) : (
              <ShowOptions
                program={program}
                change={(v) => patch("displayProgram", v)}
                section={tab}
                hidden={cfg.displayHiddenIds}
                setHidden={(v) => patch("displayHiddenIds", v)}
              />
            )}
          </div>
          <div className="signage-preview-col">
            <div className="section-heading">
              <h3>Aperçu en direct</h3>
              <span className="tag">
                {show?.items.length || 0} animaux ·{" "}
                {Math.round(show?.duration || 0)} s
              </span>
            </div>
            {show?.items.length || show?.program.inserts.length ? (
              <ShowPlayer show={show} seekFrame={seekFrame} />
            ) : (
              <Empty
                icon={Monitor}
                title="Aucun média pour cette sélection"
                text="Ajoutez une photo publique, autorisez une vidéo ou élargissez les filtres."
              />
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="panel export-program">
              <div>
                <h3>Exporter ce programme</h3>
                <small>MP4 H.264 · 1080p · son coupé · 10 min maximum</small>
              </div>
              <Button
                icon={Film}
                variant="secondary"
                disabled={
                  busy ||
                  !show ||
                  (!show.items.length && !show.program.inserts.length)
                }
                onClick={render}
              >
                Créer le MP4
              </Button>
            </div>
            {show && (
              <ShowTimeline
                show={show}
                program={program}
                change={(v) => patch("displayProgram", v)}
                seek={(f) => setSeekFrame({ frame: f, at: Date.now() })}
                notify={notify}
              />
            )}
            <div className="panel tv-link-panel">
              <h3>Lien web pour la TV</h3>
              <p>
                Ouvrez cette adresse dans le navigateur du téléviseur. Le
                programme tourne en boucle et reçoit les réglages enregistrés
                sous une minute.
              </p>
              <code>{location.origin}/#display</code>
              <Button
                variant="secondary"
                type="button"
                onClick={async () => {
                  await copyText(`${location.origin}/#display`);
                  notify("Lien TV copié.");
                }}
              >
                Copier le lien TV
              </Button>
              <small>
                Utilisez l’adresse de votre serveur ou NAS depuis la TV ;
                localhost désigne cet ordinateur.
              </small>
            </div>
            <MotionExports notify={notify} canEdit={user?.role !== "viewer"} />
          </div>
        </div>
      )}
    </>
  );
}
