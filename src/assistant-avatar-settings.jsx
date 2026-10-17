import { useEffect, useRef, useState } from "react";
import { Upload, Check, RotateCcw, LoaderCircle } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
import { FoxAvatar } from "./fox-avatar.jsx";

export function AssistantAvatarSettings({ url, onUpdate, notify }) {
  const input = useRef(),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) return setPreview(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const choose = (e) => {
    const next = e.target.files?.[0];
    e.target.value = "";
    if (!next) return;
    if (next.size > 5 * 1024 ** 2)
      return notify("Choisissez une image de 5 Mo maximum.", "error");
    setFile(next);
  };
  const apply = async (reset = false) => {
    setBusy(true);
    try {
      const body = new FormData();
      if (file && !reset) body.append("avatar", file);
      const result = await api("/admin/assistant/avatar", {
        method: reset ? "DELETE" : "POST",
        ...(reset ? {} : { body }),
      });
      onUpdate(result.url);
      setFile(null);
      notify(
        reset
          ? "Avatar par défaut rétabli."
          : "Avatar de l’assistant mis à jour.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="panel assistant-avatar-settings"
      onDragOver={(e) => {
        if (!busy && e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy)
          choose({ target: { files: e.dataTransfer.files, value: "" } });
      }}
      aria-labelledby="avatar-title"
    >
      <div className="avatar-settings-heading">
        <h2 id="avatar-title">Avatar de l’assistant</h2>
        <span>Administrateur</span>
      </div>
      <div className="avatar-settings-body">
        <FoxAvatar
          src={preview || url}
          alt="Aperçu de l’avatar de l’assistant"
          className="avatar-settings-preview"
        />
        <div className="avatar-settings-controls">
          <p>Votre image dans le bouton et le panneau de l’assistant.</p>
          <input
            ref={input}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-label="Image de l’avatar de l’assistant"
            onChange={choose}
            disabled={busy}
          />
          <div className="avatar-settings-actions">
            <Button
              type="button"
              variant="secondary"
              icon={Upload}
              disabled={busy}
              onClick={() => input.current.click()}
            >
              Choisir une image
            </Button>
            {file && (
              <Button
                type="button"
                icon={busy ? LoaderCircle : Check}
                disabled={busy}
                onClick={() => apply()}
              >
                Appliquer l’avatar
              </Button>
            )}
            {file && (
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => setFile(null)}
              >
                Annuler
              </Button>
            )}
            {!file && url && (
              <Button
                type="button"
                variant="quiet"
                icon={RotateCcw}
                disabled={busy}
                onClick={() => apply(true)}
              >
                Avatar par défaut
              </Button>
            )}
          </div>
          <small role="status">
            {busy
              ? "Enregistrement…"
              : file
                ? `${file.name} · aperçu avant application`
                : "JPG, PNG, WebP ou AVIF · 5 Mo max. · recadrage carré automatique"}
          </small>
        </div>
      </div>
    </section>
  );
}
