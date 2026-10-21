import { BoxPosterForm } from "./box-poster-form.jsx";
import { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Newspaper,
  CalendarDays,
  X,
  Check,
} from "lucide-react";
import { api, date } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
import { WorkshopAnimalSearch } from "./workshop-common.jsx";
import Gazette from "./gazette.jsx";
import Agenda from "./agenda.jsx";
import "./creative-workshop.css";
const creators = ["admin", "editor", "agent", "volunteer"];
function BoxTracking({ user, notify, open }) {
  const [rows, setRows] = useState(null),
    [filter, setFilter] = useState("active"),
    [animal, setAnimal] = useState(null),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/creative/box-posters")
      .then(setRows)
      .catch((e) => notify(e.message, "error"));
  useEffect(() => {
    load();
  }, []);
  const update = async (row, body) => {
    setBusy(true);
    try {
      await api(`/creative/box-posters/${row.id}`, {
        method: "PATCH",
        body: { ...body, revision: row.updated_at },
      });
      await load();
    } catch (e) {
      notify(e.message, "error");
      load();
    } finally {
      setBusy(false);
    }
  };
  const canEdit = creators.includes(user.role);
  return (
    <div className="form-stack">
      <p>
        Gardez la trace des affiches réellement posées. Une modification de
        photo, d’ententes ou de statut signale les affiches à vérifier.
      </p>
      <div className="work-toolbar">
        <label>
          Afficher
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Imprimées et installées</option>
            <option value="stale">À renouveler</option>
            <option value="removed">Retirées</option>
            <option value="all">Toutes</option>
          </select>
        </label>
        <span className="tag sand">
          {rows?.filter((r) => r.stale).length || 0} à vérifier
        </span>
        {canEdit && (
          <Button
            icon={ClipboardCheck}
            variant="secondary"
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? "Fermer" : "Ajouter une affiche"}
          </Button>
        )}
      </div>
      {adding &&
        (animal ? (
          <section className="panel">
            <h3>{animal.name}</h3>
            <BoxPosterForm
              animalId={animal.id}
              notify={notify}
              onSaved={() => {
                setAnimal(null);
                setAdding(false);
                load();
              }}
            />
          </section>
        ) : (
          <WorkshopAnimalSearch onSelect={setAnimal} />
        ))}
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty
          icon={ClipboardCheck}
          title="Le suivi des box commence ici."
          text="Ajoutez une affiche après l’avoir imprimée, puis indiquez quand elle est installée."
        />
      ) : (
        <div className="work-box-list">
          {rows
            .filter(
              (r) =>
                filter === "all" ||
                (filter === "stale"
                  ? r.stale
                  : filter === "removed"
                    ? r.state === "removed"
                    : r.state !== "removed"),
            )
            .map((r) => (
              <article
                className={"work-box-row " + (r.stale ? "stale" : "")}
                key={r.id}
              >
                <img src={r.preview} alt="" />
                <div>
                  <button
                    className="text-link"
                    onClick={() => open({ type: "animal", id: r.animal_id })}
                  >
                    <strong>{r.name}</strong>
                  </button>
                  <p>
                    {r.location} ·{" "}
                    {
                      {
                        printed: "Imprimée",
                        installed: "Installée",
                        removed: "Retirée",
                      }[r.state]
                    }
                  </p>
                  <small>
                    {r.installed_at
                      ? `Installée le ${date(r.installed_at)} · `
                      : ""}
                    Mise à jour le {date(r.updated_at)} par{" "}
                    {r.updated_by_name || "Équipe"}
                  </small>
                  {r.stale && (
                    <p className="work-warning">
                      À vérifier : {r.reasons.join(", ")}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="work-row-actions">
                    {r.state === "printed" && (
                      <Button
                        disabled={busy}
                        icon={Check}
                        onClick={() => update(r, { state: "installed" })}
                      >
                        Installée
                      </Button>
                    )}
                    {r.stale && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          open({
                            type: "communication",
                            animalId: r.animal_id,
                            photoId:
                              r.current_reference.kind === "spa"
                                ? "spa"
                                : r.current_reference.id,
                          })
                        }
                      >
                        Refaire l’affiche
                      </Button>
                    )}
                    {r.stale && (
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() =>
                          update(r, {
                            renew: true,
                            state: r.state,
                            ref: r.current_reference,
                          })
                        }
                      >
                        J’ai remplacé cette affiche
                      </Button>
                    )}
                    {r.state !== "removed" && (
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() => update(r, { state: "removed" })}
                      >
                        Retirée du box
                      </Button>
                    )}
                    {r.state === "removed" && (
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() =>
                          update(r, {
                            renew: true,
                            state: "printed",
                            ref: r.current_reference,
                          })
                        }
                      >
                        Réimprimée
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
export default function CreativeWorkshop(props) {
  const [tab, setTab] = useState(() => {
      try {
        const saved = localStorage.getItem(
          `anipic-workshop-tab-${props.user?.id}`,
        );
        return ["boxes", "gazette", "agenda"].includes(saved)
          ? saved
          : creators.includes(props.user?.role)
            ? "gazette"
            : "boxes";
      } catch {
        return "";
      }
    }),
    canCreate = creators.includes(props.user?.role);
  useEffect(() => {
    try {
      localStorage.setItem(`anipic-workshop-tab-${props.user?.id}`, tab);
    } catch {}
  }, [tab, props.user?.id]);
  if (!props.user) return null;
  const tabs = [
    ["boxes", "Suivi des affiches", ClipboardCheck],
    ["agenda", "Agenda partagé", CalendarDays],
    ...(canCreate ? [["gazette", "Gazette du refuge", Newspaper]] : []),
  ]
    .filter(
      ([key]) =>
        key !== "gazette" || props.ui?.enabledModules?.gazette !== false,
    )
    .filter(
      ([key]) => key !== "boxes" || props.ui?.enabledModules?.posters !== false,
    );
  return (
    <section className="panel creative-workshop">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">L’ATELIER DU REFUGE</span>
          <h2>Des photos aux nouvelles du refuge</h2>
        </div>
        {tabs.some(([id]) => id === tab) && (
          <button
            className="icon-button"
            aria-label="Fermer l’atelier"
            onClick={() => setTab("")}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="work-launchers">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            <Icon size={24} />
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      {tabs.some(([id]) => id === tab) && (
        <div className="work-content" key={tab}>
          {tab === "boxes" ? (
            <BoxTracking {...props} />
          ) : tab === "agenda" ? (
            <Agenda {...props} embedded />
          ) : (
            <Gazette {...props} />
          )}
        </div>
      )}
    </section>
  );
}
