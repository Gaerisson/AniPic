import { useState, useEffect, useCallback } from "react";
import {
  Monitor,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  Clock,
  Play,
  Pause,
  EyeOff,
} from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import {
  displayIssueLabels,
  displayOfflineMs,
} from "../shared/display-monitor.mjs";
import "./display-screens.css";
import { ScreenControls } from "./screen-controls.jsx";
const date = (value) =>
  value ? new Date(value).toLocaleString("fr-FR") : "Pas encore reçue";
const elapsed = (value, at) => {
  const seconds = Math.max(0, Math.floor((at - Date.parse(value)) / 1000));
  return seconds < 5
    ? "À l’instant"
    : seconds < 60
      ? `Il y a ${seconds} s`
      : seconds < 3600
        ? `Il y a ${Math.floor(seconds / 60)} min`
        : `Il y a ${Math.floor(seconds / 3600)} h`;
};
function ScreenCard({ screen, at, onChange, notify }) {
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(screen.name),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const online = at - Date.parse(screen.lastSeen) <= displayOfflineMs,
    health = !online ? "offline" : screen.health,
    label = !online
      ? "Hors ligne"
      : health === "warning"
        ? "Connectée · à vérifier"
        : "Connectée",
    Icon = !online ? WifiOff : health === "warning" ? AlertTriangle : Wifi,
    state = screen.status;
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api(`/admin/display/screens/${screen.id}`, {
        method: "PATCH",
        body: { name, revision: screen.revision },
      });
      setEditing(false);
      await onChange();
      notify("Nom de la TV enregistré.");
    } catch (e) {
      notify(e.message, "error");
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/admin/display/screens/${screen.id}`, {
        method: "DELETE",
        body: { revision: screen.revision },
      });
      await onChange();
      notify("Écran retiré du suivi. Son programme continue de jouer.");
    } catch (e) {
      notify(e.message, "error");
      onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`tv-screen-card health-${health}`}>
      <header>
        <span className="tv-screen-icon">
          <Monitor size={28} />
        </span>
        <div>
          <h3>{screen.name}</h3>
          <span className={`tv-connection ${health}`}>
            <Icon size={14} />
            {label}
          </span>
        </div>
        <Button
          variant="quiet"
          icon={Pencil}
          aria-label={`Renommer ${screen.name}`}
          onClick={() => {
            setName(screen.name);
            setEditing((v) => !v);
          }}
        >
          Renommer
        </Button>
      </header>
      {editing && (
        <form className="tv-rename" onSubmit={save}>
          <label>
            Nom de cet écran
            <input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button icon={Check} type="submit" disabled={busy || !name.trim()}>
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setEditing(false)}
          >
            Fermer
          </Button>
        </form>
      )}
      <ScreenControls screen={screen} notify={notify} />
      {screen.status.telemetry && (
        <p className="tv-capture-note">
          Lecteur ouvert depuis{" "}
          {Math.floor(screen.status.telemetry.uptimeSeconds / 3600)} h{" "}
          {Math.floor(screen.status.telemetry.uptimeSeconds / 60) % 60} min ·
          Réseau : {screen.status.telemetry.network} ·{" "}
          {screen.status.telemetry.reconnections} reconnexion(s) · Densité{" "}
          {screen.status.telemetry.pixelRatio}×
        </p>
      )}
      <div className="tv-screen-meta">
        <span>
          <Clock size={14} />
          {elapsed(screen.lastSeen, at)}
        </span>
        <span>
          {state.width} × {state.height}
        </span>
        <span>{state.fullscreen ? "Plein écran" : "Mode fenêtre"}</span>
        {!state.visible && (
          <span>
            <EyeOff size={14} />
            Onglet masqué
          </span>
        )}
      </div>
      <div className="tv-screen-playing">
        <span>
          {state.state === "paused" ? <Pause size={22} /> : <Play size={22} />}
        </span>
        <div>
          <small>
            {online ? screen.stateLabel : "Dernière lecture signalée"}
          </small>
          <strong>{state.scene?.title || screen.stateLabel}</strong>
          {state.scene && (
            <small>
              {Math.floor(state.scene.position)} /{" "}
              {Math.round(state.scene.duration)} s
            </small>
          )}
        </div>
      </div>
      <dl className="tv-screen-times">
        <div>
          <dt>Dernier contact</dt>
          <dd>{date(screen.lastSeen)}</dd>
        </div>
        <div>
          <dt>Dernière actualisation du programme</dt>
          <dd>{date(screen.lastSyncAt)}</dd>
        </div>
        <div>
          <dt>Réglages reçus</dt>
          <dd>{screen.current ? "À jour" : "Actualisation attendue"}</dd>
        </div>
      </dl>
      {online && !state.visible && (
        <p className="tv-screen-warning">
          L’onglet TV est masqué. Le navigateur peut ralentir sa lecture.
        </p>
      )}
      {online && screen.waitingUpdate && (
        <p className="tv-screen-warning">
          La TV n’a pas encore confirmé les derniers réglages ou l’actualisation
          du programme tarde.
        </p>
      )}
      {screen.issues.length > 0 && (
        <ul className="tv-screen-issues">
          {screen.issues.map((code) => (
            <li key={code}>
              <AlertTriangle size={15} />
              {displayIssueLabels[code]}
            </li>
          ))}
        </ul>
      )}
      <details className="tv-screen-details">
        <summary>Historique et informations</summary>
        <p>
          <strong>Adresse réseau :</strong> {screen.ip}
        </p>
        <p>
          <strong>Navigateur :</strong> {screen.browser || "Non communiqué"}
        </p>
        <p>Premier contact : {date(screen.createdAt)}</p>
        {!state.persistent && (
          <p>
            L’identité de cet écran n’est pas conservée entre les sessions du
            navigateur.
          </p>
        )}
        <ol>
          {screen.events.map((e, i) => (
            <li key={`${e.occurred_at}-${i}`}>
              <time>{date(e.occurred_at)}</time>
              <strong>
                {e.kind === "connected"
                  ? "Écran connecté"
                  : e.kind === "recovered"
                    ? "Lecture rétablie"
                    : "Incident de lecture"}
              </strong>
              {e.codes.map((code) => (
                <small key={code}>{displayIssueLabels[code]}</small>
              ))}
            </li>
          ))}
        </ol>
      </details>
      {confirm ? (
        <div className="tv-remove-confirm">
          <p>
            Masquer cet écran hors ligne ? Il réapparaîtra automatiquement à sa
            prochaine connexion, avec ses réglages.
          </p>
          <Button variant="secondary" disabled={busy} onClick={remove}>
            Confirmer le retrait
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Conserver
          </Button>
        </div>
      ) : (
        <Button
          variant="quiet"
          icon={Trash2}
          disabled={online}
          title={
            online
              ? "Le retrait est disponible quand cet écran est hors ligne."
              : "Masquer jusqu’à la prochaine connexion"
          }
          onClick={() => setConfirm(true)}
        >
          Retirer du suivi
        </Button>
      )}
    </article>
  );
}
export function DisplayScreens({ notify }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [clock, setClock] = useState(Date.now()),
    [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api("/admin/display/screens");
      setData({ ...r, receivedAt: Date.now() });
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000),
      clockTimer = setInterval(() => setClock(Date.now()), 5000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      clearInterval(clockTimer);
      window.removeEventListener("focus", load);
    };
  }, [load]);
  const at = data
      ? clock - (data.receivedAt - Date.parse(data.serverTime))
      : clock,
    connected =
      data?.screens.filter(
        (s) => at - Date.parse(s.lastSeen) <= displayOfflineMs,
      ).length || 0;
  return (
    <section className="tv-monitor panel">
      <div className="tv-monitor-heading">
        <div>
          <span className="eyebrow">LES ÉCRANS DU REFUGE</span>
          <h2>Suivi des TV</h2>
          <p>
            Dernier contact, lecture en cours et incidents signalés par chaque
            navigateur TV.
          </p>
        </div>
        <Button
          icon={RefreshCw}
          variant="secondary"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            load();
          }}
        >
          {refreshing ? "Actualisation…" : "Actualiser"}
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <div className="tv-monitor-counts">
          <span>
            <Wifi size={18} />
            <b>{connected}</b>connectée(s)
          </span>
          <span>
            <WifiOff size={18} />
            <b>{data.screens.length - connected}</b>hors ligne
          </span>
          <span>
            <AlertTriangle size={18} />
            <b>
              {
                data.screens.filter(
                  (s) =>
                    s.health === "warning" &&
                    at - Date.parse(s.lastSeen) <= displayOfflineMs,
                ).length
              }
            </b>
            à vérifier
          </span>
        </div>
      )}
      {!data && !error ? (
        <Spinner />
      ) : data?.screens.length ? (
        <div className="tv-screen-grid">
          {data.screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              at={at}
              onChange={load}
              notify={notify}
            />
          ))}
        </div>
      ) : (
        !error && (
          <div className="tv-monitor-empty">
            <Monitor size={42} />
            <h3>La première TV vous attend.</h3>
            <p>
              Ouvrez le lien web de la TV dans son navigateur. Elle apparaîtra
              ici automatiquement, puis vous pourrez la nommer « Accueil » ou «
              Salle d’attente ».
            </p>
            <a
              className="button secondary"
              href="#display"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir le lecteur TV
            </a>
          </div>
        )
      )}
      <p className="tv-monitor-note">
        Un contact est envoyé toutes les 20 secondes. Après 75 secondes sans
        nouvelles, l’écran est signalé hors ligne. Les aperçus dans AniPic ne
        sont pas comptés.
      </p>
    </section>
  );
}
