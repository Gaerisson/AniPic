import { useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";

export function GoogleSignIn({ notify }) {
  const [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [result] = useState(() =>
      new URLSearchParams(location.search).get("google"),
    );
  useEffect(() => {
    api("/auth/google/status")
      .then((v) => setAvailable(v.available))
      .catch(() => {});
    if (result) {
      const u = new URL(location.href);
      u.searchParams.delete("google");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  }, []);
  const messages = {
    pending:
      "Votre demande a été enregistrée. L’administrateur doit valider votre compte bénévole avant votre première connexion. Revenez ensuite avec ce même compte Google.",
    rejected:
      "Votre demande n’a pas été acceptée. Contactez l’administrateur du refuge.",
    disabled:
      "Votre compte n’est pas actif ou son accès réseau est limité. Contactez l’administrateur.",
    invalid:
      "La connexion Google n’a pas pu être vérifiée ou a expiré. Réessayez.",
    cancelled: "Connexion Google annulée.",
    unavailable: "La connexion Google est actuellement indisponible.",
  };
  return (
    <div className="google-signin">
      {messages[result] && (
        <p className="notice" role="status">
          <ShieldCheck size={20} />
          {messages[result]}
        </p>
      )}
      {available && (
        <>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const v = await api("/auth/google/start", {
                  method: "POST",
                  body: {},
                });
                location.assign(v.url);
              } catch (e) {
                setBusy(false);
                notify(e.message, "error");
              }
            }}
          >
            {busy ? (
              <LoaderCircle className="spin" size={20} />
            ) : (
              <svg
                viewBox="0 0 48 48"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M43.6 20.5H24v8h11.3c-1.1 5.1-5.5 8-11.3 8a12.5 12.5 0 1 1 8.8-21.3l6-6A21 21 0 1 0 45 24c0-1.2-.1-2.4-.4-3.5z"
                />
                <path
                  fill="#34A853"
                  d="M24 45c5.7 0 10.5-1.9 14-5.1l-6.4-5A12.3 12.3 0 0 1 12.3 29l-6.7 5.2A21 21 0 0 0 24 45z"
                />
                <path
                  fill="#FBBC05"
                  d="M12.3 29a12.6 12.6 0 0 1 0-10L5.6 13.8a21 21 0 0 0 0 20.4z"
                />
                <path
                  fill="#EA4335"
                  d="M24 11.5c3.3 0 6.3 1.2 8.8 3.7l6-6A21 21 0 0 0 5.6 13.8l6.7 5.2A12.5 12.5 0 0 1 24 11.5z"
                />
              </svg>
            )}
            Continuer avec Google
          </Button>
          <p className="fineprint">
            Bénévoles : créez votre compte sans mot de passe AniPic. L’accès aux
            outils est soumis à validation.
          </p>
        </>
      )}
    </div>
  );
}

export function GoogleAuthSettings({ notify }) {
  const [v, setV] = useState(null),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/google-auth")
      .then(setV)
      .catch((e) => setError(e.message));
  }, []);
  if (error && !v) return <p role="alert">{error}</p>;
  if (!v) return <Spinner />;
  return (
    <section className="panel google-auth-settings">
      <h2>Inscription des bénévoles · Google</h2>
      <p>
        Chaque nouvelle inscription reste en attente jusqu’à votre validation.
        Les accès existants ne sont jamais associés automatiquement par leur
        adresse e-mail.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const next = await api("/admin/google-auth", {
              method: "PUT",
              body: {
                enabled: v.enabled,
                clientId: v.clientId,
                ...(secret ? { clientSecret: secret } : {}),
              },
            });
            setV(next);
            setSecret("");
            notify("Connexion Google enregistrée.");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="check-line">
          <input
            type="checkbox"
            checked={v.enabled}
            onChange={(e) => setV({ ...v, enabled: e.target.checked })}
          />
          Autoriser l’inscription et la connexion avec Google
        </label>
        <label>
          Identifiant client OAuth Google
          <input
            value={v.clientId}
            onChange={(e) => setV({ ...v, clientId: e.target.value })}
            placeholder="…apps.googleusercontent.com"
          />
        </label>
        <label>
          Secret client
          <input
            type="password"
            autoComplete="new-password"
            value={secret}
            disabled={v.secretSource === "environment"}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={
              v.hasSecret
                ? "Secret déjà enregistré · laisser vide pour le conserver"
                : "Secret fourni par Google Cloud"
            }
          />
        </label>
        <label>
          URI de redirection à autoriser dans Google Cloud
          <input readOnly value={v.redirectUri} />
        </label>
        {!v.validOrigin && (
          <p role="alert">
            APP_ORIGIN doit être l’adresse HTTPS publique de votre installation,
            ou localhost pour les tests.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy}>
          {busy ? (
            <>
              <LoaderCircle className="spin" size={18} />
              Enregistrement…
            </>
          ) : (
            "Enregistrer Google"
          )}
        </Button>
      </form>
      <p className="fineprint">
        Créer un client « Application Web » dans{" "}
        <a
          href="https://console.cloud.google.com/auth/clients"
          target="_blank"
          rel="noreferrer"
        >
          Google Cloud
        </a>
        . Le guide GOOGLE.md du projet détaille la configuration.
      </p>
    </section>
  );
}

export function VolunteerRequests({ users, notify, reload }) {
  const requests = users.filter((u) =>
      ["pending", "rejected"].includes(u.google_status),
    ),
    [busy, setBusy] = useState("");
  async function review(u, decision) {
    setBusy(u.id);
    try {
      await api(`/admin/volunteers/${u.id}/review`, {
        method: "POST",
        body: { decision },
      });
      notify(
        decision === "approve"
          ? "Compte bénévole validé. La personne peut se reconnecter avec Google."
          : "Demande refusée.",
      );
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel volunteer-requests">
      <h2>
        Demandes bénévoles{" "}
        <span className="tag">
          {requests.filter((u) => u.google_status === "pending").length} en
          attente
        </span>
      </h2>
      {!requests.length ? (
        <p className="muted">
          Les nouvelles inscriptions Google apparaîtront ici.
        </p>
      ) : (
        requests.map((u) => (
          <article key={u.id}>
            <div>
              <strong>{u.google_name || u.name}</strong>
              <p>{u.google_email}</p>
              <small>
                {u.google_status === "pending" ? "À valider" : "Refusée"} ·{" "}
                {new Date(u.requested_at).toLocaleString("fr-FR")}
              </small>
            </div>
            <div>
              <Button
                disabled={!!busy}
                icon={busy === u.id ? LoaderCircle : UserCheck}
                onClick={() => review(u, "approve")}
              >
                Valider bénévole
              </Button>
              {u.google_status === "pending" && (
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  icon={UserX}
                  onClick={() => review(u, "reject")}
                >
                  Refuser
                </Button>
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
