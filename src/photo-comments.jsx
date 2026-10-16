import { useState, useEffect, useRef } from "react";
import { MessageSquare, MapPin, Send, Check, Trash2, X } from "lucide-react";
import { api, imageUrl, date } from "./api.js";
import { Button } from "./ui.jsx";
export function PhotoComments({ photo, user, notify, canEdit }) {
  const [items, setItems] = useState([]),
    [body, setBody] = useState(""),
    [anchor, setAnchor] = useState(null),
    [annotate, setAnnotate] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef();
  const load = () =>
    api(`/photos/${photo.id}/comments`)
      .then((r) => {
        setItems(r.items);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    setItems([]);
    setBody("");
    setAnchor(null);
    setAnnotate(false);
    load();
  }, [photo.id]);
  async function change(url, method, data) {
    setBusy(true);
    try {
      await api(url, { method, body: data });
      await load();
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="photo-comments feature-details">
      <summary>
        <MessageSquare size={17} />
        <strong>Commentaires de l’équipe</strong>
        <span>{items.filter((c) => !c.resolved).length}</span>
      </summary>
      <div className="feature-body">
        {error && <p role="alert">{error}</p>}
        {canEdit && (
          <Button
            variant="secondary"
            icon={MapPin}
            onClick={() => {
              setAnnotate((v) => !v);
              setAnchor(null);
            }}
          >
            {annotate ? "Fermer l’annotation" : "Pointer une zone de la photo"}
          </Button>
        )}
        {annotate && (
          <div
            className="comment-canvas"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setAnchor({
                x: (e.clientX - box.left) / box.width,
                y: (e.clientY - box.top) / box.height,
              });
              input.current?.focus();
            }}
          >
            <img
              src={imageUrl(photo.id, 1280)}
              alt="Cliquez pour placer une annotation"
            />
            {items
              .filter((c) => c.x !== null && !c.resolved)
              .map((c, i) => (
                <span
                  className="comment-pin"
                  title={c.body}
                  key={c.id}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                >
                  {i + 1}
                </span>
              ))}
            {anchor && (
              <span
                className="comment-pin draft"
                style={{
                  left: `${anchor.x * 100}%`,
                  top: `${anchor.y * 100}%`,
                }}
              >
                <MapPin size={16} />
              </span>
            )}
          </div>
        )}
        <div className="comment-list">
          {!items.length && !error && (
            <p className="muted">Aucun commentaire sur cette photo.</p>
          )}
          {items.map((c, i) => (
            <article key={c.id} className={c.resolved ? "resolved" : ""}>
              <header>
                <strong>
                  {c.x !== null && <MapPin size={13} />} {c.author}
                </strong>
                <time>{date(c.created_at)}</time>
              </header>
              <p>{c.body}</p>
              <div>
                {canEdit && (
                  <button
                    disabled={busy}
                    aria-pressed={!!c.resolved}
                    onClick={() =>
                      change(`/photo-comments/${c.id}`, "PATCH", {
                        resolved: !c.resolved,
                      })
                    }
                  >
                    <Check size={14} />
                    {c.resolved ? "Réouvrir" : "Résolu"}
                  </button>
                )}
                {canEdit &&
                  (user.id === c.user_id || user.role === "admin") && (
                    <button
                      disabled={busy}
                      aria-label="Supprimer ce commentaire"
                      onClick={() =>
                        change(`/photo-comments/${c.id}`, "DELETE")
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
        {canEdit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await change(`/photos/${photo.id}/comments`, "POST", {
                  body,
                  ...(anchor || {}),
                })
              ) {
                setBody("");
                setAnchor(null);
              }
            }}
          >
            <label>
              Commentaire interne
              <textarea
                ref={input}
                value={body}
                maxLength={1200}
                rows={3}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Une expression à garder, un recadrage à revoir…"
              />
            </label>
            <div className="feature-actions">
              {anchor && (
                <button type="button" onClick={() => setAnchor(null)}>
                  <X size={14} />
                  Retirer le point
                </button>
              )}
              <Button icon={Send} disabled={busy || !body.trim()}>
                {busy ? "Envoi…" : "Commenter"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
