import { useEffect, useState } from "react";
import { Globe, ShieldCheck, Plus, Trash2, RefreshCw } from "lucide-react";
import { api, date } from "./api.js";
import { Button } from "./ui.jsx";
export function AccessPanel({ users, notify, version }) {
  const [rules, setRules] = useState(null),
    [logs, setLogs] = useState(null),
    [filter, setFilter] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([
      api("/admin/ip-rules"),
      api("/admin/access-log?ip=" + encodeURIComponent(filter)),
    ])
      .then(([r, l]) => {
        setRules(r);
        setLogs(l);
      })
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    load();
  }, [version, filter]);
  return (
    <>
      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DES ACCÈS IDENTIFIABLES</span>
            <h2>Comptes et IP autorisées</h2>
          </div>
          <ShieldCheck size={22} />
        </div>
        <p>
          Un compte conserve son mot de passe et son rôle. Dès qu’une règle est
          ajoutée, il ne peut se connecter que depuis ses IP ou réseaux
          autorisés. Un compte administrateur garde ses droits d’administration.
        </p>
        {rules && (
          <div className="notice compact">
            Votre IP vue par le serveur : <code>{rules.ip}</code> ·{" "}
            {rules.trustProxy
              ? "Frontal de confiance configuré"
              : "Adresse de connexion directe"}
          </div>
        )}
        <form
          className="ip-rule-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = e.currentTarget;
            const input = Object.fromEntries(new FormData(form));
            try {
              await api("/admin/ip-rules", { method: "POST", body: input });
              form.reset();
              notify("Restriction IP ajoutée.");
              await load();
            } catch (error) {
              notify(error.message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Compte
            <select name="userId" required>
              <option value="">Choisir un membre</option>
              {users
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
            </select>
          </label>
          <label>
            IP ou réseau
            <input
              name="network"
              placeholder="192.168.1.40 ou 192.168.1.0/24"
              required
              maxLength={100}
            />
          </label>
          <label>
            Libellé
            <input
              name="label"
              placeholder="Équipe du refuge"
              maxLength={100}
            />
          </label>
          <Button icon={Plus} disabled={busy}>
            Autoriser cette IP
          </Button>
        </form>
        <div className="ip-rules">
          {rules?.rules.map((rule) => (
            <div key={rule.id}>
              <Globe size={19} />
              <span>
                <strong>
                  {rule.name} · {rule.network}
                </strong>
                <small>{rule.label || "Accès limité à cette adresse"}</small>
              </span>
              <button
                aria-label={
                  "Retirer la restriction " +
                  rule.network +
                  " pour " +
                  rule.name
                }
                onClick={() =>
                  api("/admin/ip-rules/" + rule.id, { method: "DELETE" })
                    .then(() => {
                      notify("Restriction retirée.");
                      load();
                    })
                    .catch((e) => notify(e.message, "error"))
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Le journal des connexions</h2>
          <Button icon={RefreshCw} variant="quiet" onClick={load}>
            Actualiser
          </Button>
        </div>
        <div className="ip-summaries">
          {logs?.ips.slice(0, 8).map((ip) => (
            <button
              className={filter === ip.ip ? "selected" : ""}
              key={ip.ip}
              onClick={() => setFilter(filter === ip.ip ? "" : ip.ip)}
            >
              <strong>{ip.ip}</strong>
              <span>
                {ip.requests} requêtes · {ip.errors} erreurs
              </span>
              <small>{new Date(ip.last_seen).toLocaleString("fr-FR")}</small>
            </button>
          ))}
        </div>
        {filter && (
          <Button variant="quiet" onClick={() => setFilter("")}>
            Toutes les IP
          </Button>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>IP</th>
                <th>Compte</th>
                <th>Requête</th>
                <th>État</th>
                <th>Navigateur</th>
              </tr>
            </thead>
            <tbody>
              {logs?.rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                  <td>
                    <code>{row.ip}</code>
                  </td>
                  <td>{row.name || "Visiteur"}</td>
                  <td>
                    <small>
                      {row.method} {row.path}
                    </small>
                  </td>
                  <td>
                    <span
                      className={"tag " + (row.status >= 400 ? "sand" : "sage")}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <span className="user-agent" title={row.user_agent}>
                      {row.user_agent || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fineprint">
          Journal privé, limité à 10 000 requêtes API. Les mots de passe, clés
          IA, cookies et paramètres d’URL ne sont pas enregistrés.
        </p>
      </section>
    </>
  );
}
