import { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  Plus,
  Save,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  LoaderCircle,
  Search,
} from "lucide-react";
import { api, date } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
const blank = {
  name: "",
  contact: "",
  reason: "",
  instructions: "",
  review_date: "",
};
export default function InternalRegister({ user, notify }) {
  const [data, setData] = useState(null),
    [query, setQuery] = useState(""),
    [deleted, setDeleted] = useState(false),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [entry, setEntry] = useState(null),
    [values, setValues] = useState(blank),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(null),
    [selected, setSelected] = useState([]);
  const fileInput = useRef();
  useEffect(() => {
    setPage(1);
  }, [query, deleted]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api(
          `/internal-register?q=${encodeURIComponent(query)}&deleted=${Number(deleted)}&page=${page}`,
        )
          .then((d) => {
            if (active) setData(d);
          })
          .catch((e) => notify(e.message, "error")),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, deleted, page, version]);
  if (!["admin", "agent"].includes(user?.role))
    return (
      <Empty
        title="Registre réservé"
        text="Accès limité aux comptes administration et agent."
      />
    );
  const edit = (record) => {
    setEntry(record || null);
    setValues(
      record
        ? Object.fromEntries(Object.keys(blank).map((k) => [k, record[k]]))
        : blank,
    );
  };
  const update = async (body) => {
    setBusy(true);
    try {
      await api("/internal-register" + (entry ? "/" + entry.id : ""), {
        method: entry ? "PATCH" : "POST",
        body,
        headers: entry ? { "X-Anipic-Version": entry.updated_at } : {},
      });
      notify(
        body.deleted === true
          ? "Entrée retirée, restauration possible."
          : "Registre enregistré.",
      );
      edit(null);
      setVersion((v) => v + 1);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api("/internal-register/import-preview", {
        method: "POST",
        body: form,
      });
      setPreview(result);
      setSelected(result.rows.map((_, i) => i));
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ESPACE ÉQUIPE · ACCÈS RESTREINT</div>
          <h1>Registre de vigilance</h1>
          <p>
            Personnes à signaler à l’équipe, observations et consignes de prise
            en charge.
          </p>
        </div>
        <Button icon={Plus} onClick={() => edit(null)}>
          Nouvelle entrée
        </Button>
      </div>
      <div className="register-toolbar panel">
        <label>
          <Search size={17} />
          Rechercher
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, contact ou motif…"
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={deleted}
            onChange={(e) => {
              setDeleted(e.target.checked);
              edit(null);
            }}
          />
          Entrées retirées
        </label>
        <input
          ref={fileInput}
          className="visually-hidden"
          hidden
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => importFile(e.target.files[0])}
        />
        <Button
          variant="secondary"
          icon={busy ? LoaderCircle : FileSpreadsheet}
          disabled={busy}
          onClick={() => fileInput.current.click()}
        >
          Importer Excel / CSV
        </Button>
      </div>
      {preview && (
        <section className="panel register-import">
          <h2>Aperçu de l’import · {preview.total} lignes</h2>
          <p>
            Première feuille · les doublons exacts nom/contact seront ignorés.
            Sélectionnez les entrées à ajouter.
          </p>
          {preview.warnings.map((w, i) => (
            <p className="error-text" key={i}>
              {w}
            </p>
          ))}
          <Button
            variant="quiet"
            onClick={() =>
              setSelected(
                selected.length === preview.rows.length
                  ? []
                  : preview.rows.map((_, i) => i),
              )
            }
          >
            Tout sélectionner / désélectionner
          </Button>
          <div className="register-import-rows">
            {preview.rows.map((r, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected((v) =>
                      e.target.checked ? [...v, i] : v.filter((n) => n !== i),
                    )
                  }
                />
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {[r.contact, r.reason].filter(Boolean).join(" · ")}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <div className="heading-actions">
            <Button
              icon={busy ? LoaderCircle : FileSpreadsheet}
              disabled={busy || !selected.length}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api("/internal-register/import", {
                    method: "POST",
                    body: { rows: selected.map((i) => preview.rows[i]) },
                  });
                  notify(
                    `${result.imported} entrée(s) ajoutée(s), ${result.skipped} doublon(s) ignoré(s).`,
                  );
                  setPreview(null);
                  setVersion((v) => v + 1);
                } catch (e) {
                  notify(e.message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ajouter {selected.length} entrée(s)
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Annuler l’import
            </Button>
          </div>
        </section>
      )}
      <div className="register-layout">
        <section className="panel register-list">
          <div className="panel-heading">
            <h2>{deleted ? "Entrées retirées" : "Personnes signalées"}</h2>
            <span>{data?.total || 0}</span>
          </div>
          {!data ? (
            <Spinner />
          ) : !data.items.length ? (
            <Empty
              icon={ShieldAlert}
              title="Aucune entrée"
              text={
                query
                  ? "Aucun résultat pour cette recherche."
                  : "Le registre est vide."
              }
            />
          ) : (
            data.items.map((r) => (
              <button
                key={r.id}
                className={entry?.id === r.id ? "selected" : ""}
                onClick={() => edit(r)}
              >
                <ShieldAlert size={21} />
                <span>
                  <strong>{r.name}</strong>
                  <small>{r.contact}</small>
                  <p>{r.reason}</p>
                  {r.review_date && (
                    <small
                      className={
                        r.review_date < new Date().toLocaleDateString("fr-CA")
                          ? "due"
                          : ""
                      }
                    >
                      À revoir le {date(r.review_date)}
                    </small>
                  )}
                </span>
              </button>
            ))
          )}
          {data?.pages > 1 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Précédent
              </Button>
              <span>
                {page}/{data.pages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.pages}
                onClick={() => setPage((v) => v + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </section>
        <section className="panel register-editor">
          <h2>{entry ? "Modifier l’entrée" : "Nouvelle entrée"}</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              update(values);
            }}
          >
            <fieldset disabled={busy || !!entry?.deleted_at}>
              <label>
                Nom / identité
                <input
                  required
                  maxLength={160}
                  value={values.name}
                  onChange={(e) =>
                    setValues({ ...values, name: e.target.value })
                  }
                />
              </label>
              <label>
                Contact ou référence
                <input
                  maxLength={200}
                  value={values.contact}
                  onChange={(e) =>
                    setValues({ ...values, contact: e.target.value })
                  }
                />
              </label>
              <label>
                Faits et observations
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={values.reason}
                  onChange={(e) =>
                    setValues({ ...values, reason: e.target.value })
                  }
                  placeholder="Contexte, date et faits observés par l’équipe…"
                />
              </label>
              <label>
                Consignes pour l’équipe
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={values.instructions}
                  onChange={(e) =>
                    setValues({ ...values, instructions: e.target.value })
                  }
                />
              </label>
              <label>
                À revoir le
                <input
                  type="date"
                  value={values.review_date}
                  onChange={(e) =>
                    setValues({ ...values, review_date: e.target.value })
                  }
                />
              </label>
              <Button icon={busy ? LoaderCircle : Save} disabled={busy}>
                Enregistrer
              </Button>
            </fieldset>
          </form>
          {entry && (
            <Button
              variant="quiet"
              icon={entry.deleted_at ? RotateCcw : Trash2}
              disabled={busy}
              onClick={() => update({ deleted: !entry.deleted_at })}
            >
              {entry.deleted_at ? "Restaurer l’entrée" : "Retirer du registre"}
            </Button>
          )}
          <small className="register-scope">
            Administration et agents uniquement · absent du site public, des
            fiches d’animaux et du contexte IA.
          </small>
          <details>
            <summary>Préparer un fichier Excel</summary>
            <p>
              En-têtes : Nom, Prénom (facultatif), Contact, Motif, Consignes,
              Révision. La date peut être au format JJ/MM/AAAA. Formats .xlsx et
              CSV UTF-8, jusqu’à 1 000 lignes.
            </p>
          </details>
        </section>
      </div>
    </>
  );
}
