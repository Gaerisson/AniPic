import { useEffect, useState } from "react";
import {
  CalendarDays,
  Users,
  Plus,
  Trash2,
  Download,
  Clock,
  Check,
} from "lucide-react";
import { api } from "./api.js";
import { Button, Modal, Spinner, Empty } from "./ui.jsx";
import { shiftKinds, participationLabels } from "../shared/volunteers.mjs";
import { parisDate } from "../shared/agenda.mjs";
const add = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export default function TeamPlanning({ user, notify, version }) {
  const [day, setDay] = useState(parisDate()),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [view, setView] = useState(() =>
      matchMedia("(max-width:620px)").matches ? "day" : "week",
    ),
    [edit, setEdit] = useState(null),
    [busy, setBusy] = useState(false),
    [availability, setAvailability] = useState(null);
  const manage = ["admin", "agent"].includes(user?.role),
    end = view === "day" ? day : add(day, 6);
  useEffect(() => {
    if (!user) return;
    let live = true;
    api(`/volunteers?from=${day}&to=${end}`)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [user?.id, day, end, version, revision]);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      setRevision((r) => r + 1);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (!user)
    return (
      <Empty
        title="Le planning de l’équipe"
        text="Connectez-vous pour consulter les présences et participer aux missions."
      />
    );
  const newShift = () =>
    setEdit({
      title: "",
      date: day,
      start: "09:00",
      end: "12:00",
      kind: "cleaning",
      location: "",
      description: "",
      capacity: 0,
      repeatWeeks: 1,
    });
  return (
    <div className="team-planning">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ENSEMBLE AU REFUGE</div>
          <h1>Présences & missions</h1>
        </div>
        {manage && (
          <Button onClick={newShift} icon={Plus}>
            Créer un créneau
          </Button>
        )}
      </div>
      <div className="planning-toolbar panel">
        <Button
          variant="ghost"
          onClick={() => setDay(add(day, view === "day" ? -1 : -7))}
        >
          ←
        </Button>
        <input
          type="date"
          aria-label="Jour du planning"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <Button
          variant="ghost"
          onClick={() => setDay(add(day, view === "day" ? 1 : 7))}
        >
          →
        </Button>
        <Button variant="secondary" onClick={() => setDay(parisDate())}>
          Aujourd’hui
        </Button>
        <select
          aria-label="Vue du planning"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option value="week">7 jours</option>
          <option value="day">Une journée</option>
          <option value="mine">Mes inscriptions</option>
        </select>
        <Button
          variant="secondary"
          onClick={() => {
            const old = data?.availability.find(
              (a) => a.mine && a.date === day,
            );
            setAvailability(
              old
                ? {
                    available: old.available,
                    start: old.start,
                    end: old.end,
                    task: old.task,
                    note: old.note,
                  }
                : {
                    available: true,
                    start: "09:00",
                    end: "17:00",
                    task: "",
                    note: "",
                  },
            );
          }}
        >
          Mes disponibilités
        </Button>
        {manage && (
          <a
            className="button secondary"
            href={"/api/volunteers/export?date=" + day}
          >
            <Download size={16} />
            Présences CSV du jour
          </a>
        )}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <section className="presence-summary panel">
            <h2>
              <Users size={20} />
              Qui sera là ?
            </h2>
            {Array.from({ length: view === "day" ? 1 : 7 }, (_, i) =>
              add(day, i),
            ).map((date) => {
              const summary = data.days.find((d) => d.date === date);
              return (
                <div className="presence-day" key={date}>
                  <strong>
                    {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </strong>
                  <div>
                    {summary?.people.length ? (
                      summary.people.map((p) => (
                        <span
                          key={p.id}
                          className="presence-person"
                          title={p.tasks.join("\n")}
                        >
                          {p.name}
                          <small>{p.tasks.join(" · ")}</small>
                        </span>
                      ))
                    ) : (
                      <small>Aucune présence confirmée</small>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
          <div className="planning-shifts">
            {data.shifts
              .filter((s) => view !== "mine" || (s.mine && s.mine !== "no"))
              .map((s) => {
                const confirmed = s.participants.filter(
                    (p) => p.state === "yes",
                  ).length,
                  full = s.capacity > 0 && confirmed >= s.capacity;
                return (
                  <article
                    className={"panel volunteer-shift kind-" + s.kind}
                    key={s.id}
                  >
                    <div className="shift-date">
                      <CalendarDays size={17} />
                      {new Date(s.date + "T12:00:00").toLocaleDateString(
                        "fr-FR",
                        { weekday: "long", day: "numeric", month: "long" },
                      )}
                      <span>
                        <Clock size={14} />
                        {s.start}–{s.end}
                      </span>
                    </div>
                    <div className="shift-heading">
                      <div>
                        <span className="eyebrow">{shiftKinds[s.kind]}</span>
                        <h2>{s.title}</h2>
                      </div>
                      {manage && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const { id, revision, participants, mine, ...v } =
                              s;
                            setEdit({ ...v, id, revision });
                          }}
                        >
                          Modifier
                        </Button>
                      )}
                    </div>
                    {s.location && <p>{s.location}</p>}
                    {s.description && <p>{s.description}</p>}
                    <div className="shift-capacity">
                      {confirmed} présent(s)
                      {s.capacity ? " / " + s.capacity + " places" : ""}
                      {full ? " · Complet" : ""}
                    </div>
                    <div className="shift-people">
                      {s.participants.map((p) => (
                        <span
                          key={p.user_id}
                          className={"signup-" + p.state}
                          title={p.note}
                        >
                          {p.name} · {participationLabels[p.state]}
                        </span>
                      ))}
                    </div>
                    <div className="shift-actions">
                      {[
                        "yes",
                        "maybe",
                        "no",
                        ...(full ? ["waitlist"] : []),
                      ].map((state) => (
                        <Button
                          key={state}
                          variant={s.mine === state ? "" : "secondary"}
                          disabled={
                            busy ||
                            (state === "yes" && full && s.mine !== "yes")
                          }
                          onClick={() =>
                            run(() =>
                              api(
                                "/volunteers/shifts/" + s.id + "/participation",
                                { method: "PUT", body: { state } },
                              ),
                            )
                          }
                        >
                          {s.mine === state && <Check size={14} />}{" "}
                          {participationLabels[state]}
                        </Button>
                      ))}
                    </div>
                  </article>
                );
              })}
          </div>
          {!data.shifts.length && (
            <Empty
              icon={CalendarDays}
              title="Une semaine à organiser"
              text="Les créneaux de collecte, de nettoyage, de promenade ou d’accueil apparaîtront ici."
              action={
                manage && (
                  <Button onClick={newShift}>Créer le premier créneau</Button>
                )
              }
            />
          )}
        </>
      )}
      {edit && (
        <Modal
          title={edit.id ? "Modifier le créneau" : "Nouveau créneau"}
          onClose={() => !busy && setEdit(null)}
        >
          <form
            className="planning-form"
            onSubmit={(e) => {
              e.preventDefault();
              const { id, ...body } = edit;
              run(async () => {
                await api("/volunteers/shifts" + (id ? "/" + id : ""), {
                  method: id ? "PUT" : "POST",
                  body,
                });
                setEdit(null);
                notify("Planning enregistré.");
              });
            }}
          >
            <label>
              Mission
              <input
                required
                maxLength="100"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                required
                value={edit.date}
                onChange={(e) => setEdit({ ...edit, date: e.target.value })}
              />
            </label>
            <div className="form-row">
              {["start", "end"].map((k) => (
                <label key={k}>
                  {k === "start" ? "Début" : "Fin"}
                  <input
                    type="time"
                    required
                    value={edit[k]}
                    onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <label>
              Type
              <select
                value={edit.kind}
                onChange={(e) => setEdit({ ...edit, kind: e.target.value })}
              >
                {Object.entries(shiftKinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lieu
              <input
                maxLength="120"
                value={edit.location}
                onChange={(e) => setEdit({ ...edit, location: e.target.value })}
              />
            </label>
            <label>
              Informations
              <textarea
                maxLength="1000"
                value={edit.description}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </label>
            <label>
              Nombre de places (0 : sans limite)
              <input
                type="number"
                min="0"
                max="100"
                value={edit.capacity}
                onChange={(e) =>
                  setEdit({ ...edit, capacity: Number(e.target.value) })
                }
              />
            </label>
            {!edit.id && (
              <label>
                Répéter chaque semaine
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={edit.repeatWeeks}
                  onChange={(e) =>
                    setEdit({ ...edit, repeatWeeks: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {edit.id && (
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                icon={Trash2}
                onClick={() => {
                  if (confirm("Annuler ce créneau et prévenir les inscrits ?"))
                    run(async () => {
                      await api("/volunteers/shifts/" + edit.id, {
                        method: "DELETE",
                        body: { revision: edit.revision },
                      });
                      setEdit(null);
                    });
                }}
              >
                Annuler le créneau
              </Button>
            )}
          </form>
        </Modal>
      )}
      {availability && (
        <Modal
          title={"Ma disponibilité · " + day}
          onClose={() => setAvailability(null)}
        >
          <form
            className="planning-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("/volunteers/availability/" + day, {
                  method: "PUT",
                  body: availability,
                });
                setAvailability(null);
              });
            }}
          >
            <label className="check">
              <input
                type="checkbox"
                checked={availability.available}
                onChange={(e) =>
                  setAvailability({
                    ...availability,
                    available: e.target.checked,
                  })
                }
              />
              Je serai présent(e)
            </label>
            <div className="form-row">
              {["start", "end"].map((k) => (
                <label key={k}>
                  {k === "start" ? "De" : "À"}
                  <input
                    type="time"
                    value={availability[k]}
                    onChange={(e) =>
                      setAvailability({ ...availability, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Pour quelle tâche ?
              <input
                maxLength="100"
                value={availability.task}
                onChange={(e) =>
                  setAvailability({ ...availability, task: e.target.value })
                }
              />
            </label>
            <label>
              Note pour l’équipe
              <textarea
                maxLength="300"
                value={availability.note}
                onChange={(e) =>
                  setAvailability({ ...availability, note: e.target.value })
                }
              />
            </label>
            <Button type="submit" disabled={busy}>
              Enregistrer
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
