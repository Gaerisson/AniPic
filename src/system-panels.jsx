import { useState, useEffect } from "react";
import { appVersion } from "../shared/version.mjs";
import { OperationSummary } from "./operation-summary.jsx";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  BookOpen,
} from "lucide-react";
import { api, date } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
export function StorageChecks({ notify }) {
  const [rows, setRows] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function check(write = false) {
    setBusy(true);
    try {
      setRows(
        await api(
          "/admin/storage/" + (write ? "check" : "health"),
          write ? { method: "POST" } : {},
        ),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    check();
  }, []);
  return (
    <section className="panel storage-checks">
      <header>
        <div>
          <h2>État des dossiers</h2>
          <small>Permissions du compte utilisé par AniPic</small>
        </div>
        <Button
          variant="secondary"
          icon={RefreshCw}
          disabled={busy}
          onClick={() => check(true)}
        >
          {busy ? "Vérification…" : "Tester l’accès"}
        </Button>
      </header>
      {error && <p role="alert">{error}</p>}
      <div>
        {rows?.map((r) => (
          <article key={r.key} data-ok={r.ok}>
            <span>
              {r.ok ? <CheckCircle2 /> : <AlertCircle />}
              <strong>{r.label}</strong>
            </span>
            <b>
              {!r.configured
                ? "Non configuré"
                : r.ok
                  ? "Accessible"
                  : "Indisponible"}
            </b>
            {r.path && <code>{r.path}</code>}
            <small>{r.error || r.mode || "Dossier facultatif"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Journal() {
  const [items, setItems] = useState(null),
    [kind, setKind] = useState("all"),
    [error, setError] = useState("");
  function load() {
    setItems(null);
    api("/admin/journal?kind=" + kind)
      .then(setItems)
      .catch((e) => setError(e.message));
  }
  useEffect(load, [kind]);
  return (
    <>
      <section className="panel journal-release">
        <BookOpen size={23} />
        <div>
          <h2>AniPic {appVersion} · Journal des évolutions</h2>
          <p>
            Configuration de l’écran du refuge accessible aux agents SPA.
            Autorisation PIN sans expiration dans AniPic, indépendante de la
            session du compte et révoquée au changement du code.
          </p>
          <a
            href="https://github.com/Gaerisson/AniPic"
            target="_blank"
            rel="noreferrer"
          >
            Projet de Gaerisson ↗
          </a>
        </div>
      </section>
      <section className="panel system-journal">
        <header>
          <h2>Opérations & erreurs</h2>
          <select
            aria-label="Filtrer le journal"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">Tout le journal</option>
            <option value="errors">Erreurs HTTP</option>
          </select>
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            Actualiser
          </Button>
        </header>
        {error && <p role="alert">{error}</p>}
        {!items ? (
          <Spinner />
        ) : items.length ? (
          items.map((r) => (
            <article key={r.id} data-kind={r.kind}>
              <span className="journal-kind">
                {r.kind === "error"
                  ? "Erreur"
                  : r.kind === "warning"
                    ? "Attention"
                    : r.kind === "action"
                      ? "Action"
                      : "Traitement"}
              </span>
              <div>
                <strong>{r.title}</strong>
                <small>
                  {r.user_name || "Système"} ·{" "}
                  {new Date(r.created_at).toLocaleString("fr-FR")}
                </small>
                <OperationSummary detail={r.detail} />
                {r.detail && (
                  <details>
                    <summary>Détails</summary>
                    <pre>
                      {typeof r.detail === "string"
                        ? r.detail.slice(0, 3000)
                        : JSON.stringify(r.detail, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </article>
          ))
        ) : (
          <p>Aucun événement enregistré.</p>
        )}
        <p className="small-note">
          Les erreurs conservent la route, le code HTTP et le compte. Les corps
          de requête, cookies et codes OAuth sont exclus.
        </p>
      </section>
    </>
  );
}
