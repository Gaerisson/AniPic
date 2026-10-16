import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
import { SyncScheduleSettings } from "./sync-schedule-settings.jsx";
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
} from "lucide-react";
export function SourceSettings({ values: v, change, notify }) {
  const [diagnostic, setDiagnostic] = useState(null),
    [jobId, setJobId] = useState(null),
    [starting, setStarting] = useState(false);
  useEffect(() => {
    let alive = true;
    api("/admin/source/diagnostic")
      .then((d) => {
        if (!alive) return;
        setDiagnostic(d);
        if (d.job?.state === "running") setJobId(d.job.id);
      })
      .catch((e) => notify(e.message, "error"));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!jobId) return;
    let alive = true,
      timer;
    const poll = async () => {
      try {
        const d = await api("/admin/source/diagnostic");
        if (!alive) return;
        if (d.job?.id === jobId) {
          setDiagnostic(d);
          if (d.job.state !== "running") {
            setJobId(null);
            return;
          }
        }
      } catch (e) {
        if (alive) {
          notify(e.message, "error");
          setJobId(null);
        }
        return;
      }
      if (alive) timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jobId]);
  const test = async () => {
    setStarting(true);
    try {
      const job = await api("/admin/source/test", { method: "POST", body: v });
      setJobId(job.id);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setStarting(false);
    }
  };
  const num = (key, label, min, max, note) => (
    <label key={key}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={v[key]}
        onChange={(e) => change(key, +e.target.value)}
      />
      {note && <small>{note}</small>}
    </label>
  );
  const flag = (key, label) => (
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={v[key]}
        onChange={(e) => change(key, e.target.checked)}
      />
      {label}
    </label>
  );
  const report = diagnostic?.report;
  const statuses = {
    blocked: "Arrêt pour robots.txt",
    unconfigured: "À configurer",
    error: "Échec de la collecte",
    partial: "Inventaire partiel",
    complete: "Inventaire complet",
  };
  return (
    <>
      <section className="panel source-main-panel">
        <div className="source-panel-heading">
          <h2>Connecteur SPA</h2>
          <span className="private-pill">Administration</span>
        </div>
        <p className="fineprint">
          Préparez le connecteur, testez vos réglages, puis enregistrez-les. Le
          test lance de vraies requêtes sans importer ni archiver d’animaux.
        </p>
        {v.sourceMode === "spa" && (
          <label>
            Accès à l’API SPA
            <select
              value={v.sourceRobotsPolicy || "respect"}
              onChange={(e) => change("sourceRobotsPolicy", e.target.value)}
            >
              <option value="respect">
                Respecter robots.txt · arrêt si exclue
              </option>
              <option value="spa_public_api">
                API publique SPA · lecture directe
              </option>
            </select>
            <small>
              robots.txt ne bloque pas le navigateur. Le second mode autorise
              explicitement Anipic à lire cette API publique ; les limites de
              débit, le filtre Morée et les protections d’archivage restent
              actifs.
            </small>
          </label>
        )}
        <div className="preset-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              change({
                sourceMode: "spa",
                sourceRobotsPolicy: "spa_public_api",
                spaRefugeSlug: "refuge-spa-de-moree-jean-leriche",
                spaRefugeUrl:
                  "https://www.la-spa.fr/etablissement/refuge-spa-de-moree-jean-leriche/",
                sourceScope: "spa:moree",
              })
            }
          >
            Préparer le refuge de Morée
          </Button>
        </div>
        <label>
          Type de source
          <select
            value={v.sourceMode}
            onChange={(e) => change("sourceMode", e.target.value)}
          >
            <option value="disabled">
              Import manuel · collecte désactivée
            </option>
            <option value="spa">Site SPA · refuge choisi</option>
            <option value="json">
              Inventaire JSON autorisé / ancienne API
            </option>
            <option value="html">HTML avec inventaire structuré</option>
          </select>
        </label>
        {v.sourceMode === "spa" ? (
          <>
            <label>
              Page du refuge
              <input
                type="url"
                value={v.spaRefugeUrl}
                maxLength="500"
                onChange={(e) => change("spaRefugeUrl", e.target.value)}
              />
            </label>
            <label>
              Identifiant du refuge
              <input
                value={v.spaRefugeSlug}
                maxLength="120"
                onChange={(e) => change("spaRefugeSlug", e.target.value)}
              />
              <small>Chaque fiche doit confirmer cet établissement.</small>
            </label>
            <details className="settings-details">
              <summary>Endpoint et identité de la source</summary>
              <label>
                Endpoint JSON SPA
                <input
                  type="url"
                  value={v.spaApiUrl}
                  onChange={(e) => change("spaApiUrl", e.target.value)}
                  maxLength="500"
                />
              </label>
              <label>
                Périmètre de synchronisation
                <input
                  value={v.sourceScope}
                  maxLength="150"
                  onChange={(e) => change("sourceScope", e.target.value)}
                />
              </label>
              <p className="fineprint">
                À ajuster lorsqu’un endpoint autorisé est fourni. Le collecteur
                attend des IDs, le refuge et une pagination explicites. HTTPS,
                domaines autorisés et contrôle des adresses restent actifs. Le
                mode de lecture directe concerne uniquement l’endpoint public
                SPA.
              </p>
            </details>
          </>
        ) : (
          v.sourceMode !== "disabled" && (
            <label>
              URL de l’inventaire
              <input
                type="url"
                value={v.sourceUrl}
                maxLength="500"
                placeholder="https://…/inventaire.json"
                onChange={(e) => change("sourceUrl", e.target.value)}
              />
              <small>
                Le flux Anipic schemaVersion: 1 est documenté dans README.md ;
                les exports historiques GPIC avec IDs sont aussi reconnus.
              </small>
            </label>
          )
        )}
        <fieldset className="species-settings">
          <legend>Espèces à récupérer</legend>
          {[
            ["dog", "Chiens"],
            ["cat", "Chats"],
            ["other", "NAC / autres"],
          ].map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <input
                type="checkbox"
                checked={v.sourceSpecies.includes(key)}
                disabled={
                  v.sourceSpecies.length === 1 && v.sourceSpecies.includes(key)
                }
                onChange={(e) =>
                  change(
                    "sourceSpecies",
                    e.target.checked
                      ? [...v.sourceSpecies, key]
                      : v.sourceSpecies.filter((x) => x !== key),
                  )
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        {flag("sourceImportReserved", "Inclure les animaux réservés")}
        <div className="source-test-actions">
          <Button
            type="button"
            icon={jobId || starting ? RefreshCw : Play}
            disabled={!!jobId || starting || v.sourceMode === "disabled"}
            onClick={test}
          >
            {jobId || starting ? "Test en cours…" : "Tester ces réglages"}
          </Button>
          <small>Aucune fiche modifiée</small>
        </div>
        <div
          className={`source-diagnostic ${report?.status || "empty"}`}
          aria-live="polite"
        >
          <div className="source-panel-heading">
            <h3>
              {report?.status === "complete" ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
              {jobId
                ? "Vérification en cours"
                : report
                  ? statuses[report.status]
                  : "Pas encore testé"}
            </h3>
            {report && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(report, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "anipic-diagnostic-source.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                <Download size={15} />
                Rapport
              </button>
            )}
          </div>
          {jobId ? (
            <p>
              Collecte limitée à {v.sourceMaxDurationSeconds} secondes. Vous
              pouvez continuer à utiliser le site.
            </p>
          ) : diagnostic?.job &&
            ["failed", "interrupted"].includes(diagnostic.job.state) ? (
            <p className="error-text">{diagnostic.job.detail}</p>
          ) : (
            <p>
              {report?.message ||
                "Le test vérifie l’accès réel à la source, les IDs, les espèces et la stabilité des listes."}
            </p>
          )}
          {report && !jobId && (
            <>
              <div className="diagnostic-metrics">
                <span>
                  <strong>{report.animalsFound}</strong> fiches reçues
                </span>
                <span>
                  <strong>{report.requests}</strong> requêtes source
                </span>
                <span>
                  <strong>{(report.durationMs / 1000).toFixed(1)} s</strong>{" "}
                  durée
                </span>
              </div>
              <small>
                Test du {new Date(report.testedAt).toLocaleString("fr-FR")} ·{" "}
                {report.configuration.attempts} passage(s) demandés ·{" "}
                {report.configuration.species.join(", ")} · configuration testée
                à cet instant
              </small>
              {report.protection && <p>{report.protection}</p>}
              {report.preview.length > 0 && (
                <div className="diagnostic-animals">
                  {report.preview.map((a) => (
                    <span key={a.sourceId}>
                      <strong>{a.name}</strong>
                      <code>{a.sourceId}</code>
                    </span>
                  ))}
                </div>
              )}
              {report.nextSteps.slice(0, 1).map((s) => (
                <p className="fineprint" key={s}>
                  {s}
                </p>
              ))}
              <details className="settings-details">
                <summary>Détail des vérifications</summary>
                {report.nextSteps.slice(1).map((s) => (
                  <p className="fineprint" key={s}>
                    {s}
                  </p>
                ))}
                <ol className="diagnostic-checks">
                  {report.checks.map((c, i) => (
                    <li key={i} className={c.status}>
                      <strong>
                        {c.stage} · {c.message}
                      </strong>
                      {c.url && <code>{c.url}</code>}
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </div>
      </section>
      <SyncScheduleSettings values={v} change={change} />
      <section className="panel">
        <h2>Collecte et protections</h2>
        <div className="form-row">
          {num(
            "sourceAttempts",
            "Passages par inventaire",
            1,
            5,
            "Au moins 2 listes identiques pour confirmer la stabilité.",
          )}
        </div>
        <details className="settings-details" open>
          <summary>Rythme et budgets</summary>
          <div className="form-row">
            {num("sourceDelayMs", "Délai entre requêtes (ms)", 1000, 10000)}
            {num("sourceTimeoutSeconds", "Timeout par requête (s)", 5, 30)}
            {num(
              "sourceMaxDurationSeconds",
              "Durée totale maximale (s)",
              15,
              180,
            )}
            {num("sourceMaxRequests", "Requêtes source maximum", 1, 150)}
            {num("sourceMaxPages", "Pages maximum par espèce", 1, 50)}
            {num(
              "sourceMaxResponseMB",
              "Taille maximale par réponse (Mo)",
              1,
              10,
            )}
          </div>
          <p className="fineprint">
            Collecte séquentielle. Les robots sont vérifiés et mis en cache
            pendant 24 h ; leur lecture s’ajoute au budget des requêtes source.
          </p>
        </details>
        <details className="settings-details">
          <summary>Qualité de l’inventaire</summary>
          <div className="form-row">
            {num("sourceMinAnimals", "Nombre minimum retenu", 1, 1000)}
            {num("sourceStaleHours", "Fraîcheur maximale (h)", 1, 48)}
            {num(
              "sourceMaxDropPercent",
              "Baisse tolérée avant blocage archivage (%)",
              0,
              100,
            )}
            {num(
              "sourceAbsenceIntervalHours",
              "Intervalle entre confirmations (h)",
              24,
              168,
            )}
          </div>
          {flag(
            "sourceAllowPartial",
            "Importer les fiches présentes même si l’inventaire est partiel",
          )}
          <p className="fineprint">
            Un inventaire partiel ou filtré ne compte jamais les absences. Les
            noms identiques restent distincts grâce à leurs IDs SPA.
          </p>
        </details>
        <details className="settings-details">
          <summary>Archivage des animaux absents</summary>
          {num(
            "missingThreshold",
            "Inventaires complets avant archivage",
            2,
            10,
          )}
          {flag(
            "archiveMissing",
            "Activer l’archivage après absences confirmées",
          )}
          <p className="fineprint">
            Aucune suppression des photos. Une absence ne compte pas comme une
            adoption. Une baisse brutale ou des données anciennes suspendent
            l’archivage.
          </p>
        </details>
      </section>
    </>
  );
}
