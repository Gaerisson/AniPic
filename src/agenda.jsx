import { useState, useEffect, useCallback, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Star,
  MapPin,
  Clock,
  Pencil,
  Trash2,
  RefreshCw,
  Monitor,
} from "lucide-react";
import { api } from "./api.js";
import { Button, Modal, Spinner } from "./ui.jsx";
import {
  monthRange,
  parisDate,
  agendaCategories,
  agendaDateLabel,
} from "../shared/agenda.mjs";
import "./agenda.css";
const canWrite = (user) =>
  ["admin", "editor", "agent", "volunteer"].includes(user?.role);
export default function Agenda({ user, notify, embedded = false }) {
  const request = useRef(0);
  const [month, setMonth] = useState(parisDate().slice(0, 7)),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState(null),
    [saving, setSaving] = useState(false),
    [confirm, setConfirm] = useState(false),
    [formError, setFormError] = useState("");
  const load = useCallback(async () => {
    if (!user) return;
    const current = ++request.current;
    const range = monthRange(month);
    try {
      const r = await api(`/agenda?from=${range.from}&to=${range.to}`);
      if (current !== request.current) return;
      setData({ ...r, month });
      setError("");
    } catch (e) {
      if (current === request.current) setError(e.message);
    }
  }, [month, user?.id]);
  useEffect(() => {
    setData(null);
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      request.current++;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);
  const open = (e) => {
    setEditing(e);
    setConfirm(false);
    setFormError("");
  };
  const change = (k, v) => setEditing((e) => ({ ...e, [k]: v }));
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      const { id, revision, author, updatedAt, ...body } = editing;
      await api(id ? `/agenda/${id}` : "/agenda", {
        method: id ? "PUT" : "POST",
        body: { ...body, ...(id ? { revision } : {}) },
      });
      setEditing(null);
      await load();
      notify("Événement enregistré dans l’agenda de l’équipe.");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try {
      await api(`/agenda/${editing.id}`, {
        method: "DELETE",
        body: { revision: editing.revision },
      });
      setEditing(null);
      await load();
      notify("Événement retiré de l’agenda.");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const move = (n) => {
    const d = new Date(month + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    const next = d.toISOString().slice(0, 7);
    if (/^20\d\d-/.test(next)) setMonth(next);
  };
  const items = (data?.month === month ? data.items : []).filter(
    (e) =>
      filter === "all" ||
      (filter === "key" && e.keyEvent) ||
      e.category === filter,
  );
  if (!user)
    return (
      <div className="panel agenda-shell">
        <p>Connectez-vous pour consulter l’agenda partagé.</p>
      </div>
    );
  return (
    <section className={`agenda-shell ${embedded ? "" : "panel"}`}>
      <div className="agenda-heading">
        <div>
          <span className="eyebrow">LES RENDEZ-VOUS DE L’ÉQUIPE</span>
          <h2>Agenda partagé</h2>
          <p>Les dates importantes du refuge, réunies au même endroit.</p>
        </div>
        {canWrite(user) && (
          <Button
            icon={Plus}
            onClick={() =>
              open({
                title: "",
                date:
                  month === parisDate().slice(0, 7)
                    ? parisDate()
                    : month + "-01",
                endDate:
                  month === parisDate().slice(0, 7)
                    ? parisDate()
                    : month + "-01",
                time: "",
                category: "event",
                location: "",
                description: "",
                keyEvent: true,
                shareGazette: true,
                showOnTV: false,
                status: "scheduled",
              })
            }
          >
            Nouvel événement
          </Button>
        )}
      </div>
      <div className="agenda-toolbar">
        <div className="agenda-month">
          <Button
            variant="secondary"
            icon={ChevronLeft}
            aria-label="Mois précédent"
            onClick={() => move(-1)}
          />
          <label>
            Mois
            <input
              type="month"
              min="2000-01"
              max="2099-12"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <Button
            variant="secondary"
            icon={ChevronRight}
            aria-label="Mois suivant"
            onClick={() => move(1)}
          />
        </div>
        <label>
          Afficher
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tous les événements</option>
            <option value="key">Dates importantes</option>
            {Object.entries(agendaCategories).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Button icon={RefreshCw} variant="secondary" onClick={load}>
          Actualiser
        </Button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data && !error ? (
        <Spinner />
      ) : (
        <>
          <div className="agenda-month-banner">
            <CalendarDays size={28} />
            <strong>
              {new Date(month + "-15T12:00:00Z").toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </strong>
            <span>{items.length} événement(s)</span>
          </div>
          {data?.truncated && (
            <p role="status">
              L’agenda dépasse 500 événements pour cette période. Affinez la
              période avant de poursuivre.
            </p>
          )}
          <div className="agenda-events">
            {items.map((e) => (
              <article
                className={`agenda-event ${e.status === "cancelled" ? "cancelled" : ""}`}
                key={e.id}
              >
                <time className="agenda-day" dateTime={e.date}>
                  <b>{e.date.slice(8)}</b>
                  <span>
                    {new Date(e.date + "T12:00:00Z").toLocaleDateString(
                      "fr-FR",
                      { month: "short", timeZone: "UTC" },
                    )}
                  </span>
                </time>
                <div className="agenda-event-main">
                  <div className="agenda-badges">
                    <span>{agendaCategories[e.category]}</span>
                    {e.keyEvent && (
                      <span>
                        <Star size={12} />
                        Date clé
                      </span>
                    )}
                    {e.status === "cancelled" && <span>Annulé</span>}
                    {e.showOnTV && (
                      <span>
                        <Monitor size={12} />
                        TV
                      </span>
                    )}
                  </div>
                  <h3>{e.title}</h3>
                  <div className="agenda-meta">
                    <span>
                      <Clock size={14} />
                      {agendaDateLabel(e.date)}
                      {e.endDate && e.endDate !== e.date
                        ? ` au ${agendaDateLabel(e.endDate)}`
                        : ""}
                      {e.time ? ` · ${e.time}` : ""}
                    </span>
                    {e.location && (
                      <span>
                        <MapPin size={14} />
                        {e.location}
                      </span>
                    )}
                  </div>
                  {e.description && <p>{e.description}</p>}
                  <small>
                    Mis à jour par {e.author} ·{" "}
                    {new Date(e.updatedAt).toLocaleString("fr-FR")}
                  </small>
                </div>
                {canWrite(user) && (
                  <Button
                    icon={Pencil}
                    variant="secondary"
                    aria-label={`Modifier ${e.title}`}
                    onClick={() => open(e)}
                  >
                    Modifier
                  </Button>
                )}
              </article>
            ))}
          </div>
          {items.length === 0 && (
            <div className="agenda-empty">
              <CalendarDays size={36} />
              <h3>Le mois reste à écrire.</h3>
              <p>Ajoutez un événement ou consultez un autre mois.</p>
            </div>
          )}
        </>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Modifier l’événement" : "Nouvel événement"}
          onClose={() => {
            if (!saving) setEditing(null);
          }}
          className="agenda-modal"
        >
          <form className="form-stack agenda-form" onSubmit={save}>
            <label>
              Intitulé
              <input
                autoFocus
                required
                maxLength={100}
                value={editing.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                Début
                <input
                  type="date"
                  required
                  min="2000-01-01"
                  max="2099-12-31"
                  value={editing.date}
                  onChange={(e) =>
                    setEditing((v) => ({
                      ...v,
                      date: e.target.value,
                      endDate:
                        !v.endDate || v.endDate < e.target.value
                          ? e.target.value
                          : v.endDate,
                    }))
                  }
                />
              </label>
              <label>
                Fin
                <input
                  type="date"
                  required
                  min={editing.date}
                  max="2099-12-31"
                  value={editing.endDate || editing.date}
                  onChange={(e) => change("endDate", e.target.value)}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Heure · facultative
                <input
                  type="time"
                  value={editing.time}
                  onChange={(e) => change("time", e.target.value)}
                />
              </label>
              <label>
                Catégorie
                <select
                  value={editing.category}
                  onChange={(e) => change("category", e.target.value)}
                >
                  {Object.entries(agendaCategories).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Lieu
              <input
                maxLength={120}
                value={editing.location}
                onChange={(e) => change("location", e.target.value)}
              />
            </label>
            <label>
              Informations
              <textarea
                rows={4}
                maxLength={500}
                value={editing.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </label>
            <fieldset className="agenda-publication">
              <legend>Où retrouver cet événement ?</legend>
              {[
                ["keyEvent", "Marquer comme date importante"],
                ["shareGazette", "Reprendre dans la gazette"],
                ["showOnTV", "Diffuser sur l’écran TV (visible par le public)"],
              ].map(([k, label]) => (
                <label className="checkbox-label" key={k}>
                  <input
                    type="checkbox"
                    checked={editing[k]}
                    onChange={(e) => change(k, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              État
              <select
                value={editing.status}
                onChange={(e) => change("status", e.target.value)}
              >
                <option value="scheduled">Prévu</option>
                <option value="cancelled">Annulé</option>
              </select>
            </label>
            {formError && (
              <p role="alert" className="error">
                {formError}
              </p>
            )}
            <div className="agenda-form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Fermer
              </Button>
              {editing.id && (
                <Button
                  type="button"
                  icon={Trash2}
                  variant="quiet"
                  disabled={saving}
                  onClick={() => setConfirm(true)}
                >
                  Retirer
                </Button>
              )}
            </div>
            {confirm && (
              <div className="agenda-delete" role="alert">
                <p>
                  Retirer cet événement de l’agenda, de la gazette automatique
                  et de la TV ?
                </p>
                <Button type="button" disabled={saving} onClick={remove}>
                  Confirmer le retrait
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setConfirm(false)}
                >
                  Conserver
                </Button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
