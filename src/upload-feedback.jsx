import { useEffect, useState } from "react";
import { UploadCloud, LoaderCircle, Video } from "lucide-react";
import { bytes } from "./api.js";
export function UploadPreviews({ files = [], busy = false, progress = 0 }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const next = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setItems(next);
    return () => next.forEach((i) => URL.revokeObjectURL(i.url));
  }, [files]);
  if (!files.length) return null;
  return (
    <section className="upload-feedback" aria-live="polite" aria-busy={busy}>
      <div className="upload-preview-grid">
        {items.map(({ file, url }, i) => (
          <figure key={i}>
            {file.type.startsWith("image/") ? (
              <img src={url} alt={file.name} />
            ) : file.type.startsWith("video/") ? (
              <video src={url} muted preload="metadata" />
            ) : (
              <Video />
            )}
            <figcaption>
              {file.name}
              <small>{bytes(file.size)}</small>
            </figcaption>
            {busy && (
              <span className="upload-file-state">
                <LoaderCircle className="spin" size={16} />
              </span>
            )}
          </figure>
        ))}
      </div>
      {busy && (
        <>
          <progress
            max="100"
            value={progress}
            aria-label="Progression de l’import"
          />
          <p>
            <LoaderCircle className="spin" size={15} />
            {progress < 100
              ? `Envoi · ${progress} %`
              : "Traitement et vérification des fichiers…"}
          </p>
        </>
      )}
    </section>
  );
}
export function DropArea({ onFiles, disabled = false, children }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={"media-drop-area " + (over ? "drag-over" : "")}
      onDragOver={(e) => {
        if (!disabled && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          if (!disabled) onFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {children || (
        <>
          <UploadCloud size={24} />
          <span>Glissez vos photos ou vidéos ici</span>
        </>
      )}
    </div>
  );
}
