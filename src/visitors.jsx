import { useState, useEffect } from "react";
import {
  Globe,
  Users,
  Eye,
  Monitor,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Activity,
  Smartphone,
  ArrowUpRight,
} from "lucide-react";
import { api, copyText } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
const regions = new Intl.DisplayNames(["fr"], { type: "region" });
const routes = {
  gallery: "Accueil & photos",
  animals: "Les animaux",
  studio: "Studio vidéo",
  motion: "Fonds animés",
  broadcasts: "Vidéo C8",
  settings: "Configuration",
  todo: "Planning photo",
  api: "API & connexions",
  display: "Écran TV",
  displaySettings: "Écran du refuge",
  feed: "Fil du refuge",
  history: "Historique SPA",
  visitors: "Visiteurs",
  editor: "Éditeur photo",
  print: "Feuille de séance",
  tools: "Outils de l’équipe",
  about: "À propos",
  inbox: "Photos à trier",
  collections: "Albums privés",
};
const pageName = (path) => routes[path?.replace(/^#/, "")] || path;
const countryName = (code) => {
  try {
    return code ? regions.of(code) : "Non déterminé";
  } catch {
    return "Non déterminé";
  }
};
const country = (r) =>
  r.country
    ? countryName(r.country)
    : /^(127\.|::1$|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(r.ip)
      ? "Réseau local"
      : "Non déterminé";
const count = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);
function Breakdown({ title, icon: Icon, items, total, format = (v) => v }) {
  return (
    <section className="panel visitor-breakdown">
      <h2>
        <Icon size={18} />
        {title}
      </h2>
      {items.length ? (
        items.map((item, i) => (
          <div className="visitor-rank" key={item.name || "unknown"}>
            <div>
              <span>{format(item.name)}</span>
              <strong>
                {count(item.views)}{" "}
                <small>
                  {Math.round((item.views / Math.max(1, total)) * 100)} %
                </small>
              </strong>
            </div>
            <div className="visitor-meter">
              <i
                style={{
                  width: `${(item.views / Math.max(1, total)) * 100}%`,
                  opacity: 1 - i * 0.08,
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="muted">Aucune consultation.</p>
      )}
    </section>
  );
}
export function Visitors() {
  const [data, setData] = useState(null),
    [days, setDays] = useState(7),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [expanded, setExpanded] = useState(null),
    [copied, setCopied] = useState(null);
  useEffect(() => {
    let active = true;
    setBusy(true);
    const timer = setTimeout(
      () =>
        api(`/admin/visitors?days=${days}&query=${encodeURIComponent(query)}`)
          .then((d) => {
            if (active) {
              setData(d);
              setError("");
            }
          })
          .catch((e) => active && setError(e.message))
          .finally(() => active && setBusy(false)),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [days, query, revision]);
  useEffect(() => {
    setPage(0);
  }, [days, query]);
  const rows = data?.rows.slice(page * 20, page * 20 + 20) || [],
    max = Math.max(1, ...(data?.daily || []).map((d) => d.views)),
    total = data?.summary.pageviews || 0;
  return (
    <div className="visitors-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FRÉQUENTATION DU SITE</div>
          <h1>Visiteurs</h1>
        </div>
        <div className="heading-actions">
          <select
            aria-label="Période des visiteurs"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[1, 7, 30].map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "Aujourd’hui" : `${d} derniers jours`}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            icon={RefreshCw}
            disabled={busy}
            onClick={() => setRevision((v) => v + 1)}
          >
            Actualiser
          </Button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="visitor-summary">
            {[
              [
                Eye,
                data.summary.pageviews,
                "Pages vues",
                "Consultations enregistrées",
              ],
              [
                Users,
                data.summary.sessions,
                "Sessions",
                "Sessions distinctes par onglet",
              ],
              [
                Globe,
                data.summary.addresses,
                "Adresses IP",
                "Adresses distinctes",
              ],
              [
                Monitor,
                data.summary.accounts,
                "Comptes",
                "Comptes connectés sur la période",
              ],
            ].map(([Icon, n, label, detail]) => (
              <section className="panel visitor-metric" key={label}>
                <div>
                  <span className="visitor-metric-icon">
                    <Icon size={20} />
                  </span>
                  <span>{label}</span>
                </div>
                <strong>{count(n)}</strong>
                <small>{detail}</small>
              </section>
            ))}
          </div>
          <div className="visitor-overview-grid">
            <section className="panel visitor-chart">
              <div className="section-heading">
                <div>
                  <h2>Évolution des visites</h2>
                  <small>
                    {days === 1 ? "Aujourd’hui" : `${days} jours`} · heure de
                    Paris
                  </small>
                </div>
                <span className="visitor-live">
                  <i />
                  {data.summary.online || 0} session
                  {data.summary.online === 1 ? "" : "s"} · 5 min
                </span>
              </div>
              <div
                className="visitor-bars"
                role="img"
                aria-label={data.daily
                  .map((d) => `${d.day}: ${d.views} vues`)
                  .join(", ")}
              >
                {data.daily.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.views} vues · ${d.sessions} sessions`}
                  >
                    <strong>{d.views ? count(d.views) : ""}</strong>
                    <div className="visitor-bar-track">
                      <i
                        style={{
                          height: `${(d.views / max) * 100}%`,
                          minHeight: d.views ? 4 : 2,
                          opacity: d.views ? 1 : 0.15,
                        }}
                      />
                    </div>
                    <small>
                      {new Date(d.day + "T12:00:00Z").toLocaleDateString(
                        "fr-FR",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          timeZone: "Europe/Paris",
                        },
                      )}
                    </small>
                  </div>
                ))}
              </div>
              <div className="visitor-chart-legend">
                <span>
                  <i />
                  Pages vues
                </span>
                <small>
                  {data.generatedAt
                    ? `Actualisé à ${new Date(data.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </small>
              </div>
            </section>
            <section className="panel visitor-top-pages">
              <div className="section-heading">
                <h2>Pages consultées</h2>
                <ArrowUpRight size={18} />
              </div>
              {data.pages.length ? (
                data.pages.slice(0, 6).map((p, i) => (
                  <div className="visitor-page-rank" key={p.path}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{pageName(p.path)}</strong>
                      <div className="visitor-meter">
                        <i
                          style={{
                            width: `${(p.views / Math.max(1, data.pages[0].views)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <b>{count(p.views)}</b>
                  </div>
                ))
              ) : (
                <p className="muted">Aucune consultation.</p>
              )}
            </section>
          </div>
          <div className="visitor-breakdown-grid">
            <Breakdown
              title="Appareils"
              icon={Smartphone}
              items={data.breakdowns?.devices || []}
              total={total}
            />
            <Breakdown
              title="Navigateurs"
              icon={Monitor}
              items={(data.breakdowns?.browsers || []).slice(0, 5)}
              total={total}
            />
            <Breakdown
              title="Pays"
              icon={Globe}
              items={data.breakdowns?.countries || []}
              total={total}
              format={countryName}
            />
          </div>
          <section className="panel visitor-log">
            <div className="section-heading">
              <div>
                <h2>Journal des consultations</h2>
                <small>
                  {data.rows.length}
                  {data.rows.length === 500 ? " dernières" : ""} consultation
                  {data.rows.length === 1 ? "" : "s"}
                  {query ? " correspondantes" : ""}
                </small>
              </div>
              <label className="visitor-search">
                <Search size={16} />
                <input
                  aria-label="Rechercher un visiteur"
                  placeholder="IP, compte ou page…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {busy && <Activity size={14} />}
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Date et heure",
                      "Adresse IP",
                      "Pays",
                      "Compte",
                      "Page",
                      "Navigateur / appareil",
                    ].map((x) => (
                      <th key={x} scope="col">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <VisitRow
                      key={r.id}
                      r={r}
                      expanded={expanded === r.id}
                      expand={() =>
                        setExpanded((v) => (v === r.id ? null : r.id))
                      }
                      copied={copied === r.id}
                      copy={async () => {
                        try {
                          await copyText(r.ip);
                          setCopied(r.id);
                        } catch {
                          setError("Copie indisponible sur ce navigateur.");
                        }
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <div className="visitor-no-results">
                <Search size={24} />
                <p>
                  Aucune consultation
                  {query
                    ? " ne correspond à cette recherche"
                    : " enregistrée sur la période"}
                  .
                </p>
              </div>
            )}
            <div className="visitor-log-footer">
              <small>Conservation : 30 jours · accès administrateur</small>
              <div>
                <Button
                  variant="quiet"
                  icon={ChevronLeft}
                  aria-label="Consultations précédentes"
                  disabled={!page}
                  onClick={() => setPage((v) => v - 1)}
                />
                <span>
                  {data.rows.length
                    ? `${page * 20 + 1}–${Math.min((page + 1) * 20, data.rows.length)} / ${data.rows.length}`
                    : "0"}
                </span>
                <Button
                  variant="quiet"
                  icon={ChevronRight}
                  aria-label="Consultations suivantes"
                  disabled={(page + 1) * 20 >= data.rows.length}
                  onClick={() => setPage((v) => v + 1)}
                />
              </div>
            </div>
          </section>
          <p className="visitor-privacy-note">
            Géolocalisation locale indicative ·{" "}
            <a href="https://db-ip.com" target="_blank" rel="noreferrer">
              IP Geolocation by DB-IP
            </a>
            {data.geoip?.updatedAt
              ? ` · base du ${new Date(data.geoip.updatedAt).toLocaleDateString("fr-FR")}`
              : ""}
          </p>
          {data.countrySource === "unconfigured" && (
            <p className="visitor-privacy-note">
              <Globe size={15} />
              La localisation nécessite un proxy de confiance avec
              VISITOR_COUNTRY_HEADER. Les adresses locales n’ont pas de pays.
            </p>
          )}
        </>
      )}
    </div>
  );
}
function VisitRow({ r, expanded, expand, copied, copy }) {
  const date = new Date(r.created_at);
  return (
    <>
      <tr>
        <td>
          <strong>
            {date.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </strong>
          <small>{date.toLocaleDateString("fr-FR")}</small>
        </td>
        <td>
          <span className="visitor-ip">
            <code>{r.ip}</code>
            <button
              title="Copier l’adresse IP"
              aria-label={`Copier l’IP ${r.ip}`}
              onClick={copy}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </span>
        </td>
        <td>
          <span className="visitor-country">
            {r.country && (
              <img src={`/api/flags/${r.country.toLowerCase()}`} alt="" />
            )}
            {country(r)}
          </span>
          {r.location?.city && (
            <small>
              {r.location.city}
              {r.location.region ? ` · ${r.location.region}` : ""}
            </small>
          )}
        </td>
        <td>
          <span className={`visitor-account ${r.account ? "is-member" : ""}`}>
            <i>{r.account ? r.account[0].toUpperCase() : "·"}</i>
            {r.account || "Visiteur"}
          </span>
        </td>
        <td>
          <span className="visitor-route">{pageName(r.path)}</span>
        </td>
        <td>
          <button
            className="visitor-browser"
            aria-expanded={expanded}
            onClick={expand}
          >
            <strong>
              {r.browser}
              <span> · {r.os}</span>
            </strong>
            <small>{r.device} · détails</small>
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="visitor-details">
          <td colSpan="6">
            <strong>Informations du navigateur</strong>
            <p>{r.user_agent || "Non transmis"}</p>
            <code>
              {r.path} · IPv
              {r.location?.ipVersion || (r.ip.includes(":") ? 6 : 4)}
            </code>
            <p>
              {[
                r.location?.city,
                r.location?.region,
                r.location?.continent,
                r.location?.timezone,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
