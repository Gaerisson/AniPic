import { useEffect, useState } from "react";
import {
  Bell,
  Monitor,
  Smartphone,
  ShieldCheck,
  Download,
  LogOut,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
export default function AccountHub({ user, notify, reload, go }) {
  const [data, setData] = useState(null),
    [devices, setDevices] = useState(null),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [target, setTarget] = useState(""),
    [accounts, setAccounts] = useState([]),
    [error, setError] = useState("");
  const [activation, setActivation] = useState("");
  useEffect(() => {
    if (user?.role === "admin")
      api("/admin/users")
        .then((d) => setAccounts(Array.isArray(d) ? d : d.users || []))
        .catch(() => {});
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      api("/notifications/preferences"),
      api("/account/devices" + (target ? "?userId=" + target : "")),
    ])
      .then(([a, b]) => {
        if (active) {
          setData(a);
          setDevices(b);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [user?.id, revision, target]);
  if (!user)
    return (
      <Empty
        title="Votre compte"
        text="Connectez-vous pour gérer les notifications et les appareils."
      />
    );
  if (!data) return error ? <p role="alert">{error}</p> : <Spinner />;
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      setRevision((r) => r + 1);
    } catch (e) {
      setActivation(e.message);
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const enable = async () => {
    if (!window.isSecureContext)
      throw Error("Les notifications nécessitent une connexion HTTPS.");
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      throw Error(
        "Les notifications ne sont pas disponibles dans ce navigateur. Utilisez Chrome à jour en HTTPS.",
      );
    setActivation("Autorisation du navigateur…");
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error(
        "Notifications refusées. Vous pouvez modifier ce choix dans les paramètres du navigateur.",
      );
    setActivation("Préparation de cet appareil…");
    let timeout;
    let registration;
    try {
      await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                Error(
                  "Le service de notifications ne démarre pas. Rechargez la page puis réessayez.",
                ),
              ),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    const existing = await registration.pushManager.getSubscription();
    const key = Uint8Array.from(
      atob(data.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
    const result = await api("/notifications/subscriptions", {
      method: "POST",
      body: subscription.toJSON(),
    });
    if (result.requiresResubscribe) {
      await subscription.unsubscribe();
      const fresh = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const retried = await api("/notifications/subscriptions", {
        method: "POST",
        body: fresh.toJSON(),
      });
      if (retried.requiresResubscribe) {
        await fresh.unsubscribe();
        throw Error(
          "Le navigateur a réutilisé un ancien abonnement. Fermez puis rouvrez AniPic et réessayez.",
        );
      }
    }
    notify("Notifications activées sur cet appareil.");
    setActivation("Cet appareil est prêt. Vous pouvez envoyer un test.");
  };
  return (
    <div className="account-hub">
      <header className="page-heading">
        <div>
          <span className="eyebrow">VOTRE ESPACE PERSONNEL</span>
          <h1>Compte & appareils</h1>
          <p>Vos nouvelles, vos appareils, vos accès.</p>
        </div>
        <Button
          variant="secondary"
          icon={Settings}
          onClick={() => go("appOptions")}
        >
          Options de l’app
        </Button>
      </header>
      <section className="panel">
        <h2>
          <Bell size={20} />
          Mes notifications
        </h2>
        <p>
          Choisissez les nouvelles que vous souhaitez recevoir. Ces choix
          concernent votre compte ; activez ensuite chaque appareil.
        </p>
        <div className="notification-choices">
          {Object.entries({
            arrivals: "Nouveaux arrivants",
            adoptions: "Adoptions et départs adoptés",
            photos: "Nouvelles photos publiques",
            planning: "Modification ou annulation de mes missions",
          }).map(([k, label]) => (
            <label key={k} className="check">
              <input
                type="checkbox"
                checked={data.preferences[k]}
                disabled={busy}
                onChange={(e) => {
                  const preferences = {
                    ...data.preferences,
                    [k]: e.target.checked,
                  };
                  run(async () => {
                    await api("/notifications/preferences", {
                      method: "PUT",
                      body: preferences,
                    });
                    setData({ ...data, preferences });
                  });
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="notification-diagnostic" role="status">
          <span
            className={
              "status-dot " +
              (data.subscriptions.some((s) => s.current) ? "ready" : "")
            }
          />
          <div>
            <strong>
              {data.subscriptions.some((s) => s.current)
                ? "Cet appareil est enregistré"
                : "Cet appareil reste à activer"}
            </strong>
            <small>
              {!window.isSecureContext
                ? "HTTPS nécessaire"
                : !("Notification" in window)
                  ? "Notifications non prises en charge"
                  : Notification.permission === "denied"
                    ? "Autorisation bloquée dans les réglages du navigateur"
                    : Notification.permission === "granted"
                      ? "Autorisation navigateur accordée"
                      : "Autorisation navigateur à demander"}
            </small>
          </div>
        </div>
        <Button
          disabled={busy || !Object.values(data.preferences).some(Boolean)}
          onClick={() => run(enable)}
        >
          {busy && activation
            ? activation
            : data.subscriptions.some((s) => s.current)
              ? "Réparer / réactiver cet appareil"
              : "Activer sur cet appareil"}
        </Button>
        {data.subscriptions.some((s) => s.current) && (
          <Button
            disabled={busy}
            variant="secondary"
            onClick={() =>
              run(async () => {
                await api("/notifications/test", { method: "POST", body: {} });
                notify(
                  "Test envoyé. Vérifiez les notifications Android ou du navigateur.",
                );
              })
            }
          >
            Envoyer une notification de test
          </Button>
        )}
        {activation && !busy && (
          <p className="small-note" role="status">
            {activation}
          </p>
        )}
        {data.subscriptions.map((s) => (
          <div className="device-row" key={s.id}>
            <span>
              {s.current ? "Cet appareil · " : ""}Notifications activées le{" "}
              {new Date(s.created_at).toLocaleDateString("fr-FR")}
              {s.last_error ? " · Envoi à vérifier" : ""}
            </span>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  api("/notifications/subscriptions/" + s.id, {
                    method: "DELETE",
                  }),
                )
              }
            >
              Désactiver
            </Button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>
          <ShieldCheck size={20} />
          Connexions autorisées
        </h2>
        {user.role === "admin" && (
          <label>
            Compte
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Mon compte</option>
              {accounts
                .filter((a) => a.id !== user.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <p>
          {devices?.totalSessions || 0} session(s) active(s). La connexion reste
          mémorisée et peut être retirée à tout moment.
        </p>
        {devices?.devices.map((d) => (
          <div className="device-row" key={d.id}>
            {/Android|iPhone/.test(d.user_agent) ? (
              <Smartphone size={22} />
            ) : (
              <Monitor size={22} />
            )}
            <div>
              <strong>
                {d.current ? "Cet appareil" : "Appareil connecté"}
              </strong>
              <p>{d.user_agent || "Navigateur non précisé"}</p>
              <small>
                {d.ip} · Dernière activité :{" "}
                {new Date(d.last_seen).toLocaleString("fr-FR")}
              </small>
            </div>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => {
                if (
                  confirm(
                    d.current
                      ? "Déconnecter cet appareil ?"
                      : "Révoquer cette connexion ?",
                  )
                )
                  run(async () => {
                    const r = await api(
                      "/account/devices/" +
                        d.id +
                        (target ? "?userId=" + target : ""),
                      { method: "DELETE" },
                    );
                    if (r.current) reload();
                  });
              }}
            >
              Révoquer
            </Button>
          </div>
        ))}
        <Button
          disabled={busy}
          variant="secondary"
          onClick={() => {
            if (confirm("Déconnecter les autres sessions de ce compte ?"))
              run(() =>
                api(
                  "/account/disconnect" + (target ? "?userId=" + target : ""),
                  { method: "POST", body: { includeCurrent: false } },
                ),
              );
          }}
        >
          Déconnecter les autres appareils
        </Button>
      </section>
      <section className="panel">
        <h2>Mes données</h2>
        <p>
          Exportez les informations de votre compte. Pour une rectification ou
          suppression, contactez l’exploitant indiqué dans la politique de
          confidentialité.
        </p>
        <a
          className="button secondary"
          href="/api/account/data"
          download="anipic-mes-donnees.json"
        >
          <Download size={16} />
          Exporter mes données
        </a>
      </section>
    </div>
  );
}
