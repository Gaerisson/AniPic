import { useState, useEffect } from "react";
import { FolderSync, Save, RefreshCw } from "lucide-react";
import { api, date } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
export function ImportAutomation({ notify }) {
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () =>
    api("/inbox/automation")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  if (!data)
    return (
      <section className="panel">
        {error ? <p role="alert">{error}</p> : <Spinner />}
      </section>
    );
  return (
    <section className="panel import-automation">
      <header className="feature-section-heading">
        <h2>
          <FolderSync size={20} />
          Import Lightroom / Photoshop
        </h2>
        <span className="tag">
          {data.configured ? "Dossier raccordé" : "Dossier à raccorder"}
        </span>
      </header>
      <p>
        Publiez vos JPEG dans le dossier de dépôt. Anipic les ajoute à « Photos
        à trier » et suggère l’animal d’après le nom du dossier ou son
        identifiant.
      </p>
      <div className="workbench-form-grid">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(e) =>
              setData((v) => ({ ...v, enabled: e.target.checked }))
            }
          />
          Lecture automatique
        </label>
        <label>
          Toutes les (minutes)
          <input
            type="number"
            min={1}
            max={1440}
            value={data.intervalMinutes}
            onChange={(e) =>
              setData((v) => ({
                ...v,
                intervalMinutes: Number(e.target.value),
              }))
            }
          />
        </label>
        <label>
          Attendre après écriture (secondes)
          <input
            type="number"
            min={10}
            max={600}
            value={data.stableSeconds}
            onChange={(e) =>
              setData((v) => ({ ...v, stableSeconds: Number(e.target.value) }))
            }
          />
        </label>
      </div>
      {!data.configured && (
        <p className="fineprint">
          Docker : renseignez ANIPIC_IMPORT_PATH et activez compose.import.yml.
          Installation directe : IMPORT_DIR. Le dossier source est lu sans
          déplacement ni suppression des fichiers.
        </p>
      )}
      {!data.scheduler && (
        <p className="fineprint">
          La démo désactive les tâches automatiques. La planification sera
          active sur le serveur de production.
        </p>
      )}
      <div className="feature-actions">
        <Button
          icon={Save}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/inbox/automation", {
                method: "PUT",
                body: {
                  enabled: data.enabled,
                  intervalMinutes: data.intervalMinutes,
                  stableSeconds: data.stableSeconds,
                },
              });
              notify("Import automatique configuré.");
              load();
            } catch (e) {
              notify(e.message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer l’import
        </Button>
        <Button variant="secondary" icon={RefreshCw} onClick={load}>
          Actualiser
        </Button>
      </div>
      {data.last && (
        <small>
          Dernière lecture : {new Date(data.last.at).toLocaleString("fr-FR")} ·{" "}
          {data.last.error ||
            `${data.last.added} ajout(s), ${data.last.duplicates} déjà importée(s)`}
        </small>
      )}
    </section>
  );
}
