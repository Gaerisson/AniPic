import { useState, useEffect, useRef } from "react";
import { Upload, Trash2 } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function UserPicture({ user, className = "" }) {
  const [version, setVersion] = useState(user?.avatarHash || null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    setVersion(user?.avatarHash || null);
    const refresh = (e) => {
      if (e.detail?.userId === user?.id) {
        setFailed(false);
        setVersion(e.detail.hash);
      }
    };
    window.addEventListener("anipic-avatar", refresh);
    return () => window.removeEventListener("anipic-avatar", refresh);
  }, [user?.id, user?.avatarHash]);
  return user && version && !failed ? (
    <img
      className={`user-picture ${className}`}
      src={`/api/users/${user.id}/avatar?v=${version}`}
      alt={`Avatar de ${user.name}`}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={`user-picture ${className}`}>
      {user?.name?.slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}
export function UserAvatarEditor({ user, notify }) {
  const input = useRef(),
    [busy, setBusy] = useState(false);
  async function save(file, reset = false) {
    if (!file && !reset) return;
    setBusy(true);
    try {
      const body = new FormData();
      if (file) body.append("avatar", file);
      const result = await api(`/users/${user.id}/avatar`, {
        method: reset ? "DELETE" : "POST",
        ...(reset ? {} : { body }),
      });
      window.dispatchEvent(
        new CustomEvent("anipic-avatar", {
          detail: { userId: user.id, hash: result.hash || null },
        }),
      );
      notify(reset ? "Avatar retiré." : "Avatar enregistré.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="avatar-editor">
      <UserPicture user={user} />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          save(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        icon={Upload}
        disabled={busy}
        onClick={() => input.current.click()}
      >
        {busy ? "Chargement…" : "Changer l’avatar"}
      </Button>
      <button
        type="button"
        className="icon-button"
        aria-label="Retirer l’avatar"
        disabled={busy}
        onClick={() => save(null, true)}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
