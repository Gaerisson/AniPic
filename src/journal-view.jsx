import { useEffect, useState, useRef } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  LoaderCircle,
  Activity,
  Search,
  ExternalLink,
} from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { OperationSummary, operationResult } from "./operation-summary.jsx";
import { formatInstant, instant } from "../shared/instant.mjs";
import { appVersion } from "../shared/version.mjs";
export function ServerClock() {
  const [data, setData] = useState(null),
    [tick, setTick] = useState(Date.now());
  useEffect(() => {
    let live = true;
    const sent = Date.now();
    api("/admin/system-time")
      .then(
        (d) =>
          live &&
          setData({ ...d, drift: Date.parse(d.utc) - (sent + Date.now()) / 2 }),
      )
      .catch(() => {});
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  if (!data) return null;
  return (
    <section className="panel journal-clock">
      <div>
        <span className="eyebrow">HORLOGE DU SERVEUR</span>
        <strong>{formatInstant(tick + data.drift)}</strong>
        <p>Affichage Europe/Paris · données enregistrées en UTC</p>
        {Math.abs(data.drift) > 120000 && (
          <p role="status">
            Écart de {Math.round(Math.abs(data.drift) / 60000)} min avec cet
            appareil. Vérifiez la synchronisation des horloges.
          </p>
        )}
      </div>
      <details>
        <summary>Comprendre et corriger l’heure</summary>
        <p>
          Le conteneur utilise l’horloge du NAS. Activez la synchronisation
          automatique NTP dans les réglages du NAS. Dans Portainer, gardez{" "}
          <code>TZ=Europe/Paris</code>. Ce réglage change le fuseau d’affichage,
          pas l’heure système.
        </p>
        <p>
          Fuseau du processus : {data.processZone}. L’application ne modifie
          jamais l’horloge du NAS.
        </p>
      </details>
    </section>
  );
}
export default function JournalView() {
  const [items, setItems] = useState(null),
    [kind, setKind] = useState("important"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(true),
    request = useRef(null);
  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const result = await api("/admin/journal", { signal: controller.signal });
      if (live.current && !controller.signal.aborted) {
        setItems(result);
        setError("");
      }
    } catch (e) {
      if (live.current && e.name !== "AbortError") setError(e.message);
    } finally {
      if (live.current && !controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    load();
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") load();
    }, 10000);
    return () => {
      live.current = false;
      request.current?.abort();
      clearInterval(timer);
    };
  }, []);
  const quiet = (r) =>
    r.action === "inbox_scanned" &&
    !(Number(operationResult(r.detail)?.added) > 0);
  const rows = (items || [])
    .filter((r) =>
      kind === "important"
        ? !quiet(r)
        : kind === "errors"
          ? ["error", "warning"].includes(r.kind)
          : kind === "running"
            ? r.state === "running"
            : kind === "actions"
              ? r.kind === "action"
              : true,
    )
    .filter((r) =>
      (r.title + " " + (r.user_name || "Système") + " " + (r.detail || ""))
        .toLocaleLowerCase("fr")
        .includes(search.toLocaleLowerCase("fr")),
    );
  const running = (items || []).filter((r) => r.state === "running").length,
    errors = (items || []).filter((r) => r.kind === "error").length;
  return (
    <div className="journal314">
      <ServerClock />
      <section className="panel journal-clock">
        <div>
          <span className="eyebrow">ANIPIC {appVersion}</span>
          <strong>Ce qui se passe dans votre refuge.</strong>
          <p>
            Actualisation automatique toutes les 10 secondes. Les contrôles sans
            changement restent disponibles dans « Tout ».
          </p>
        </div>
        <a
          href={`https://github.com/Gaerisson/AniPic/releases/tag/v${appVersion}`}
          target="_blank"
          rel="noreferrer"
        >
          Notes de version <ExternalLink size={13} />
        </a>
      </section>
      <div className="journal-summary">
        <span>
          {running > 0 ? (
            <LoaderCircle size={13} className="spin" />
          ) : (
            <CheckCircle2 size={13} />
          )}{" "}
          {running} opération(s) en cours
        </span>
        <span>{errors} erreur(s) dans les événements récents</span>
        <span>Heures de Paris</span>
      </div>
      <section className="panel">
        <header className="journal-toolbar">
          <h2>Opérations & événements</h2>
          <input
            aria-label="Rechercher dans le journal"
            placeholder="Action, compte, code d’erreur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Type d’événements"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="important">Événements utiles</option>
            <option value="running">En cours</option>
            <option value="errors">Erreurs & avertissements</option>
            <option value="actions">Actions de l’équipe</option>
            <option value="all">Tout le journal</option>
          </select>
          <Button
            icon={RefreshCw}
            variant="secondary"
            loading={busy}
            onClick={load}
          >
            Actualiser
          </Button>
        </header>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {!items ? (
          <Spinner />
        ) : rows.length ? (
          <div className="journal-list">
            {rows.map((r) => {
              const Icon =
                r.state === "running"
                  ? LoaderCircle
                  : r.kind === "error" || r.kind === "warning"
                    ? AlertCircle
                    : r.kind === "job"
                      ? CheckCircle2
                      : Activity;
              const result = operationResult(r.detail);
              return (
                <article
                  className="journal-entry"
                  key={r.kind + ":" + r.id}
                  data-kind={r.kind}
                >
                  <i>
                    <Icon
                      size={17}
                      className={r.state === "running" ? "spin" : ""}
                    />
                  </i>
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {r.user_name || "Système"}
                      {r.state === "running" ? " · traitement en cours" : ""}
                    </small>
                    {r.state === "running" && (
                      <div className="startup-track">
                        <i />
                      </div>
                    )}
                    <OperationSummary detail={r.detail} />
                    {result?.progress !== undefined && (
                      <progress
                        max="100"
                        value={result.progress}
                        aria-label="Progression"
                      />
                    )}
                    {r.detail && (
                      <details>
                        <summary>Détails techniques</summary>
                        <pre>
                          {typeof r.detail === "string"
                            ? r.detail.slice(0, 3000)
                            : JSON.stringify(r.detail, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <time
                    dateTime={
                      Number.isFinite(instant(r.created_at).getTime())
                        ? instant(r.created_at).toISOString()
                        : undefined
                    }
                  >
                    {formatInstant(r.created_at, "Europe/Paris", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    <small>
                      {formatInstant(r.created_at, "Europe/Paris", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                  </time>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <CheckCircle2 size={28} />
            <h3>
              {kind === "errors"
                ? "Aucune erreur dans cette sélection"
                : kind === "running"
                  ? "Tout est au repos"
                  : "Aucun événement correspondant"}
            </h3>
            <p>Les nouvelles opérations apparaîtront ici automatiquement.</p>
          </div>
        )}
      </section>
    </div>
  );
}
