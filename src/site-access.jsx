import { useEffect, useState } from "react";
import { LockKeyhole, Save, Shield, UserRound, Upload } from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { Login } from "./dialogs.jsx";
export function SiteGate({
  reload,
  onLogin,
  session,
  notify,
  preferAccount = false,
}) {
  const [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [login, setLogin] = useState(preferAccount);
  return (
    <main className="site-gate">
      <section className="panel">
        <img src="/anipic-logo.svg" alt="AniPic" />
        <span className="site-gate-lock">
          <LockKeyhole size={28} />
        </span>
        <h1>Bienvenue dans AniPic</h1>
        <p>Saisissez le code d’accès pour ouvrir la photothèque.</p>
        <p className="fineprint">
          Ce navigateur sera mémorisé sans limite de durée dans AniPic, jusqu’à
          l’effacement de ses cookies ou au changement du PIN.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/gate/unlock", { method: "POST", body: { pin } });
              reload();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Code d’accès
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              minLength={6}
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy || pin.length < 6} icon={LockKeyhole}>
            Ouvrir AniPic
          </Button>
        </form>
        <Button variant="quiet" icon={UserRound} onClick={() => setLogin(true)}>
          Se connecter avec un compte
        </Button>
        <small>© {new Date().getFullYear()} Gaerisson</small>
      </section>
      {login && (
        <Login
          session={session}
          notify={notify}
          onClose={() => setLogin(false)}
          onLogin={onLogin}
        />
      )}
    </main>
  );
}
export function SiteAccessSettings({ notify }) {
  const [v, setV] = useState(null),
    [pin, setPin] = useState(""),
    [networks, setNetworks] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/site-access")
      .then((d) => {
        setV(d);
        setNetworks(d.networks.join("\n"));
      })
      .catch((e) => notify(e.message, "error"));
  }, []);
  if (!v) return <Spinner />;
  return (
    <section className="panel site-access-settings">
      <h2>
        <Shield size={20} />
        Accès à l’outil
      </h2>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={v.enabled}
          onChange={(e) => setV({ ...v, enabled: e.target.checked })}
        />
        Demander un code PIN au premier accès
      </label>
      <div className="form-two">
        <label>
          {v.configured
            ? "Nouveau code · laisser vide pour conserver"
            : "Code PIN · 6 à 12 chiffres"}
          <input
            type="password"
            autoComplete="new-password"
            inputMode="numeric"
            maxLength={12}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label>
          Compte agent pour les IP du refuge
          <select
            value={v.agentId}
            onChange={(e) => setV({ ...v, agentId: e.target.value })}
          >
            <option value="">Aucun compte automatique</option>
            {v.agents.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        IP ou réseaux du refuge · une entrée par ligne
        <textarea
          rows={3}
          placeholder={"Exemple : 203.0.113.25\n192.168.1.0/24"}
          value={networks}
          onChange={(e) => setNetworks(e.target.value)}
        />
      </label>
      <p className="fineprint">
        Ces IP ouvrent automatiquement le compte agent choisi. Le bouton «
        Changer de compte » permet ensuite une connexion personnelle. Le PIN est
        mémorisé sans expiration dans AniPic, tant que le navigateur conserve
        ses cookies. Changer le code révoque les accès précédents.
      </p>
      {!v.agents.length && (
        <p>
          Créez d’abord un compte avec le rôle Agent SPA dans Équipe & accès.
        </p>
      )}
      <Button
        type="button"
        icon={Save}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/admin/site-access", {
              method: "PUT",
              body: {
                enabled: v.enabled,
                pin,
                agentId: v.agentId,
                networks: networks
                  .split(/[\n,]/)
                  .map((x) => x.trim())
                  .filter(Boolean),
              },
            });
            setPin("");
            setV({ ...v, configured: v.configured || !!pin });
            notify("Accès et IP du refuge enregistrés.");
          } catch (e) {
            notify(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        Enregistrer la protection et les IP
      </Button>
    </section>
  );
}
export function GeoIPSettings({ notify }) {
  const [info, setInfo] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/admin/geoip")
      .then(setInfo)
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="panel geoip-settings">
      <h2>GeoIP local</h2>
      <p className="fineprint">
        Pays, drapeau et ville approximative. Les IP ne sont pas transmises à un
        prestataire.
      </p>
      <small>
        {info
          ? `${info.source} · base du ${new Date(info.updatedAt).toLocaleDateString("fr-FR")}`
          : "Chargement de la base…"}
      </small>
      <label className="button secondary">
        <Upload size={16} />
        Mettre à jour la base MMDB
        <input
          type="file"
          accept=".mmdb,.gz"
          disabled={busy}
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const body = new FormData();
            body.append("database", f);
            setBusy(true);
            try {
              await api("/admin/geoip", { method: "POST", body });
              notify("Base GeoIP mise à jour.");
              load();
            } catch (e) {
              notify(e.message, "error");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <a href="https://db-ip.com/db/lite.php" target="_blank" rel="noreferrer">
        Télécharger une base DB-IP Lite · CC BY 4.0
      </a>
    </section>
  );
}
