import { useEffect, useState, useRef } from "react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
import {
  audiencePage,
  audienceAllowed,
  audienceLabels,
} from "../shared/audience.mjs";

export function useAnonymousAudience(page, privacy) {
  const status = privacy.data?.audience;
  useEffect(() => {
    if (
      !status?.enabled ||
      status.optedOut ||
      status.globalPrivacyControl ||
      navigator.globalPrivacyControl === true
    )
      return;
    let sent = false;
    const count = () => {
      if (sent || document.hidden) return;
      let cookie = "";
      try {
        cookie = document.cookie;
      } catch {}
      if (
        !audienceAllowed(
          status,
          cookie,
          navigator.globalPrivacyControl === true,
        )
      )
        return;
      sent = true;
      // No identifier, storage, cookies, referrer, query string or personal data.
      fetch("/api/audience/pageview", {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: audiencePage(page) }),
        keepalive: true,
      }).catch(() => {});
    };
    count();
    document.addEventListener("visibilitychange", count);
    return () => document.removeEventListener("visibilitychange", count);
  }, [page, status?.enabled, status?.optedOut, status?.globalPrivacyControl]);
}

export function AudienceSummary({ days = 7, revision = 0 }) {
  const generation = useRef(0),
    saving = useRef(false);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true,
      loading = false;
    const load = async () => {
      if (loading || document.hidden || saving.current) return;
      loading = true;
      const request = ++generation.current;
      try {
        const d = await api(`/admin/audience?days=${days}`);
        if (active && request === generation.current) {
          setData(d);
          setError("");
        }
      } catch (e) {
        if (active && request === generation.current) setError(e.message);
      } finally {
        loading = false;
      }
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [days, revision]);
  return (
    <section className="panel anonymous-audience" aria-label="Audience anonyme">
      <div className="section-heading">
        <div>
          <div className="eyebrow">COMPTAGE LOCAL SANS COOKIE</div>
          <h2>Consultations anonymes</h2>
        </div>
        <strong className="audience-total">
          {data ? new Intl.NumberFormat("fr-FR").format(data.total) : "…"}
        </strong>
      </div>
      <p>
        Pages consultées sur {days === 1 ? "la journée" : `${days} jours`}, même
        sans accepter le suivi détaillé. Aucun visiteur unique, compte ou
        adresse IP n’est identifié. Les visites détaillées ci-dessous concernent
        uniquement les personnes ayant accepté.
      </p>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="audience-pages">
            {data.pages.slice(0, 8).map((p) => (
              <span key={p.page}>
                <b>{audienceLabels[p.page] || "Autres rubriques"}</b>
                <strong>{p.views}</strong>
              </span>
            ))}
            {!data.total && (
              <span>Les prochaines consultations apparaîtront ici.</span>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={data.enabled}
              disabled={busy}
              onChange={async (e) => {
                const enabled = e.target.checked;
                saving.current = true;
                generation.current++;
                setBusy(true);
                try {
                  await api("/admin/audience", {
                    method: "PUT",
                    body: { enabled },
                  });
                  setData((d) => ({ ...d, enabled }));
                  window.dispatchEvent(new Event("anipic-privacy-changed"));
                } catch (e) {
                  setError(e.message);
                } finally {
                  saving.current = false;
                  setBusy(false);
                }
              }}
            />{" "}
            Compter les consultations anonymes sur cette instance
          </label>
          <small>
            Totaux locaux conservés {data.retentionDays} jours · opposition
            disponible dans Confidentialité · GPC respecté.
          </small>
        </>
      )}
    </section>
  );
}
