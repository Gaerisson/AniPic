import { useEffect, useState } from "react";
import { Bell, Check, Send, X } from "lucide-react";
import { api, date } from "./api.js";
import { Button, Modal } from "./ui.jsx";
export function useTeamMessages(user, version, notify) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    let active = true;
    const load = () => {
      if (document.visibilityState === "visible")
        api("/messages")
          .then((v) => active && setMessages(v))
          .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, version]);
  const read = async (id) => {
    try {
      await api(`/messages/${id}/read`, { method: "POST" });
      setMessages((v) =>
        v.map((m) =>
          m.id === id ? { ...m, read_at: new Date().toISOString() } : m,
        ),
      );
    } catch (e) {
      notify(e.message, "error");
    }
  };
  return { messages, read };
}
export function HomeMessages({
  teamMessages = [],
  readMessage,
  popupAllowed = true,
}) {
  const [later, setLater] = useState([]),
    pending = teamMessages.filter((m) => !m.read_at && !later.includes(m.id)),
    m = pending[0];
  if (!m || !popupAllowed) return null;
  return (
    <Modal
      title="Message de l’équipe"
      className="team-message-popup"
      onClose={() => setLater((v) => [...v, m.id])}
    >
      <div className="team-popup-content">
        <span className="team-popup-icon">
          <Bell size={28} />
        </span>
        <small>
          {date(m.created_at)} · {pending.length} message(s) à lire
        </small>
        <h2>{m.title}</h2>
        <p>{m.body}</p>
        <div className="feature-actions">
          <Button icon={Check} onClick={() => readMessage(m.id)}>
            Lu
          </Button>
          <Button variant="quiet" onClick={() => setLater((v) => [...v, m.id])}>
            Plus tard
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function AdminMessages({ data, notify, reload }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="message-admin-grid">
      <form
        className="panel form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            fields = Object.fromEntries(new FormData(form)),
            target = fields.target;
          setBusy(true);
          try {
            await api("/admin/messages", {
              method: "POST",
              body: {
                title: fields.title,
                body: fields.body,
                targetUser: target.startsWith("user:") ? target.slice(5) : null,
                targetRole: target.startsWith("role:") ? target.slice(5) : null,
                days: Number(fields.days),
              },
            });
            notify("Message envoyé à l’accueil des destinataires.");
            form.reset();
            reload();
          } catch (e) {
            notify(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Nouveau message</h2>
        <label>
          Destinataires
          <select name="target" defaultValue="role:agent">
            <option value="role:agent">Agents SPA</option>
            <option value="role:volunteer">Bénévoles</option>
            <option value="all">Toute l’équipe</option>
            <option value="role:editor">Photographes</option>
            {data.users
              .filter((u) => u.active)
              .map((u) => (
                <option key={u.id} value={`user:${u.id}`}>
                  {u.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Titre
          <input name="title" maxLength="100" required />
        </label>
        <label>
          Message
          <textarea name="body" maxLength="2500" rows="5" required />
        </label>
        <label>
          Visible pendant (jours)
          <input
            name="days"
            type="number"
            min="1"
            max="90"
            defaultValue="7"
            required
          />
        </label>
        <Button icon={Send} disabled={busy}>
          Envoyer le message
        </Button>
      </form>
      <section className="panel message-history">
        <h2>Messages envoyés</h2>
        {!data.messages.length && <p>Aucun message envoyé.</p>}
        {data.messages.map((m) => (
          <article key={m.id}>
            <div>
              <strong>{m.title}</strong>
              <p>{m.body}</p>
              <small>
                {m.recipient ||
                  (m.target_role === "agent"
                    ? "Agents SPA"
                    : m.target_role || "Toute l’équipe")}{" "}
                · {m.read_count} lecture(s) · {date(m.created_at)}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label={`Retirer le message ${m.title}`}
              onClick={async () => {
                try {
                  await api(`/admin/messages/${m.id}`, { method: "DELETE" });
                  reload();
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              <X size={17} />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
