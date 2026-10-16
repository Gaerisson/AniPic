import { useState, useEffect } from "react";
import { Camera, Globe } from "lucide-react";
export function SpaPhoto({
  animal,
  large = false,
  loading = "lazy",
  compact = false,
}) {
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [waiting, setWaiting] = useState(false);
  useEffect(() => {
    setFailed(false);
    setAttempt(0);
    setWaiting(false);
  }, [animal.id, animal.source_metadata?.thumbnail]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(
      () => {
        setAttempt((v) => v + 1);
        setWaiting(false);
      },
      1500 * (attempt + 1),
    );
    return () => clearTimeout(t);
  }, [waiting, attempt]);
  return (
    <span className={`spa-source-photo ${large ? "large" : ""}`}>
      {!failed && animal.source_metadata?.thumbnail ? (
        <img
          loading={loading}
          src={`/api/animals/${animal.id}/source-photo?w=${large ? 1280 : compact ? 320 : 640}${attempt ? `&retry=${attempt}` : ""}`}
          alt={`Photo du site SPA : ${animal.name}`}
          onError={() => {
            if (attempt < 2) setWaiting(true);
            else setFailed(true);
          }}
        />
      ) : (
        <Camera size={32} />
      )}
      <i className="spa-reference-mark" aria-hidden="true">
        <Camera size={30} />
      </i>
      <span>
        <Globe size={12} />
        {large ? "Photo du site SPA · aucune photo locale" : "Source SPA"}
      </span>
    </span>
  );
}
