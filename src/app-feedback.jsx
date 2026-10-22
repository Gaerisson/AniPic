import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { appVersion } from "../shared/version.mjs";
import { networkSnapshot } from "./api.js";
import { Button } from "./ui.jsx";

const preferencesKey = "anipic-connection-options";
function readPreferences() {
  try {
    return {
      visible: true,
      debug: false,
      ...JSON.parse(localStorage.getItem(preferencesKey) || "{}"),
    };
  } catch {
    return { visible: true, debug: false };
  }
}
export function useConnection() {
  const [state, setState] = useState(() => ({
    ...networkSnapshot(),
    online: navigator.onLine && networkSnapshot().online,
  }));
  useEffect(() => {
    const change = (e) =>
      setState((s) => ({ ...s, online: e.type === "online" }));
    const network = (e) => setState((s) => ({ ...s, ...e.detail }));
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    window.addEventListener("anipic-network", network);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      window.removeEventListener("anipic-network", network);
    };
  }, []);
  return state;
}
export function NetworkBadge({
  visible,
  debug,
  detail,
  offline,
  television = false,
}) {
  const connection = useConnection();
  const [prefs, setPrefs] = useState(readPreferences);
  useEffect(() => {
    const update = () => setPrefs(readPreferences());
    window.addEventListener("anipic-connection-options", update);
    return () =>
      window.removeEventListener("anipic-connection-options", update);
  }, []);
  const shown = visible ?? prefs.visible,
    diagnostics = debug ?? prefs.debug;
  const online = !offline && connection.online;
  if (!shown && !diagnostics) return null;
  return (
    <aside
      className={`connection-badge ${television ? "tv-connection" : ""} ${online ? "online" : "offline"}`}
      aria-live="polite"
    >
      {shown && (
        <span>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? "Connecté" : "Hors connexion · reconnexion automatique"}
        </span>
      )}
      {diagnostics && (
        <small>
          AniPic {appVersion}
          {connection.latency !== null ? ` · ${connection.latency} ms` : ""}
          {connection.at
            ? ` · contact ${new Date(connection.at).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}`
            : " · en attente du serveur"}
          {detail ? ` · ${detail}` : ""}
        </small>
      )}
    </aside>
  );
}
export function RequestProgress() {
  const [count, setCount] = useState(0),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const change = (e) => setCount(e.detail.pending);
    window.addEventListener("anipic-requests", change);
    return () => window.removeEventListener("anipic-requests", change);
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () => setVisible(count > 0),
      count > 0 ? 220 : 180,
    );
    return () => clearTimeout(timer);
  }, [count > 0]);
  return (
    visible && (
      <div
        className="request-progress"
        role="status"
        aria-label="Traitement en cours"
      >
        <i />
        <span>
          {count > 1 ? `${count} opérations en cours` : "Traitement en cours"}
        </span>
      </div>
    )
  );
}
export function StartupScreen({ error, retry, television = false }) {
  return (
    <main className={`startup-screen ${television ? "startup-tv" : ""}`}>
      <div className="startup-orbit">
        <i />
        <i />
        <img src="/anipic-icon.svg" alt="AniPic" />
      </div>
      <div className="eyebrow">
        {television ? "L’ÉCRAN DU REFUGE" : "BIENVENUE DANS VOTRE REFUGE"}
      </div>
      <h1>
        {error
          ? "Retrouvons la connexion."
          : television
            ? "Les rencontres se préparent."
            : "Une nouvelle journée commence."}
      </h1>
      <p>
        {error ||
          (television
            ? "Préparation du programme et des portraits…"
            : "Chargement de votre espace AniPic…")}
      </p>
      {error ? (
        <Button onClick={retry} icon={RefreshCw}>
          Réessayer
        </Button>
      ) : (
        <div className="startup-track">
          <i />
        </div>
      )}
      <small>Vos données restent conservées pendant une interruption.</small>
    </main>
  );
}
export function ConnectionPreferences() {
  const [prefs, setPrefs] = useState(readPreferences);
  const change = (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event("anipic-connection-options"));
  };
  return (
    <section className="panel connection-preferences">
      <h2>Repères de connexion</h2>
      <p>
        Choix mémorisés sur ce navigateur. L’écran TV possède ses propres
        réglages.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={prefs.visible}
          onChange={(e) => change("visible", e.target.checked)}
        />
        Afficher le statut de connexion
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={prefs.debug}
          onChange={(e) => change("debug", e.target.checked)}
        />
        Afficher les diagnostics discrets (version, délai, dernier contact)
      </label>
    </section>
  );
}
