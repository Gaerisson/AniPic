import { useState, useEffect } from "react";
import { Camera, Download, BarChart3, LockKeyhole } from "lucide-react";
import { api, speciesName } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
export function Insights({ user, open, go, ui }) {
  const allowed = !!user || ui?.pageAccess?.stats === "public";
  const [year, setYear] = useState(new Date().getFullYear()),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    api("/stats?year=" + year)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [year, user?.id, allowed]);
  if (!allowed)
    return (
      <Empty
        icon={LockKeyhole}
        title="Statistiques du refuge"
        text="Connectez-vous pour consulter les données de l’équipe."
        action={
          <Button onClick={() => open({ type: "login" })}>Se connecter</Button>
        }
      />
    );
  const download = () => {
    const rows = [
      ["Mois", "Fiches ajoutées", "Adoptions signalées SPA", "Albums archivés"],
      ...data.monthly.map((m) => [m.month, m.added, m.adopted, m.archived]),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statistiques-${year}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Statistiques</h1>
          <p>Photothèque et statuts observés dans la source SPA.</p>
        </div>
        <div className="heading-actions">
          <select
            aria-label="Année des statistiques"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[
              ...new Set([
                new Date().getFullYear(),
                ...(data?.years || []),
                year,
              ]),
            ]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y}>{y}</option>
              ))}
          </select>
          <Button
            icon={Download}
            variant="secondary"
            disabled={!data}
            onClick={download}
          >
            CSV
          </Button>
        </div>
      </div>
      {error ? (
        <Empty text={error} />
      ) : !data ? (
        <Spinner />
      ) : (
        <>
          <div className="insight-counters">
            {[
              ["Présents", data.current.present],
              [
                "Chiens présents",
                data.species.find((s) => s.species === "dog")?.present || 0,
              ],
              [
                "Chats présents",
                data.species.find((s) => s.species === "cat")?.present || 0,
              ],
              [
                "NAC présents",
                data.species.find((s) => s.species === "other")?.present || 0,
              ],
              ["Fiches ajoutées en " + year, data.annual.added],
              ["Adoptions signalées en " + year, data.annual.adopted],
            ].map(([name, value]) => (
              <div className="panel" key={name}>
                <small>{name}</small>
                <strong>{value || 0}</strong>
              </div>
            ))}
          </div>
          <section className="panel insight-chart">
            <h2>Au fil de {year}</h2>
            <div className="chart-legend">
              <span>● Fiches ajoutées</span>
              <span>● Adoptions signalées</span>
              <span>● Archivages</span>
            </div>
            <div
              className="month-chart"
              role="img"
              aria-label={
                "Fiches, adoptions signalées et archivages par mois en " + year
              }
            >
              {data.monthly.map((m) => {
                const max = Math.max(
                  1,
                  ...data.monthly.flatMap((m) => [
                    m.added,
                    m.adopted,
                    m.archived,
                  ]),
                );
                return (
                  <div
                    key={m.month}
                    title={`${m.added} fiches / ${m.adopted} adoptions signalées / ${m.archived} archives`}
                  >
                    <div className="month-bars">
                      {["added", "adopted", "archived"].map((k) => (
                        <i
                          key={k}
                          className={k}
                          style={{
                            height: `${Math.max(2, (m[k] / max) * 100)}%`,
                          }}
                        >
                          <span>{m[k] || ""}</span>
                        </i>
                      ))}
                    </div>
                    <small>
                      {new Date(2026, m.month - 1, 1).toLocaleDateString(
                        "fr-FR",
                        { month: "short" },
                      )}
                    </small>
                  </div>
                );
              })}
            </div>
            <details>
              <summary>Données du graphique</summary>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Fiches ajoutées</th>
                    <th>Adoptions signalées</th>
                    <th>Archivages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td>{m.added}</td>
                      <td>{m.adopted}</td>
                      <td>{m.archived}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <div className="insight-bottom">
            <section className="panel">
              <h2>Couverture photo</h2>
              <p>
                <strong>{data.coverage}</strong> animaux photographiés ·{" "}
                <strong>{data.noPhoto}</strong> sans photo locale active
              </p>
              <progress
                max={Math.max(1, data.coverage + data.noPhoto)}
                value={data.coverage}
              />
              <Button icon={Camera} onClick={() => go("todo")}>
                Voir les animaux à photographier
              </Button>
            </section>
            <section className="panel">
              <h2>Statuts enregistrés</h2>
              <p>
                {data.current.adopted || 0} adoptés ·{" "}
                {data.current.reserved || 0} réservés ·{" "}
                {data.current.unconfirmed || 0} absences à confirmer.
              </p>
              <p className="fineprint">
                {data.adoptionDateBasis} Les années passées ne peuvent pas être
                reconstituées sans historique.{" "}
                {data.unknownAdoptionDates > 0 &&
                  `${data.unknownAdoptionDates} adoptions sans date connue.`}
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
