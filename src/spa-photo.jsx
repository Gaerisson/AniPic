import { useState, useEffect, useRef } from "react";
import { Camera, Globe, LoaderCircle } from "lucide-react";
export function SpaPhoto(props) {
  return (
    <SourcePhoto
      key={
        props.animal.id +
        ":" +
        (props.animal.source_metadata?.thumbnail || "") +
        ":" +
        !!props.large +
        ":" +
        !!props.compact
      }
      {...props}
    />
  );
}
function SourcePhoto({
  animal,
  large = false,
  loading = "lazy",
  compact = false,
  watermark = true,
}) {
  const img = useRef(null);
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false),
    [attempt, setAttempt] = useState(0),
    [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setLoaded(true);
  }, [attempt]);
  useEffect(() => {
    if (loaded || failed || !img.current) return;
    let timer;
    const start = () => {
      timer = setTimeout(() => setFailed(true), 45000);
    };
    let observer;
    if (loading === "lazy" && "IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      });
      observer.observe(img.current);
    } else start();
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [loaded, failed, attempt, loading]);
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
    <span
      className={`spa-source-photo ${large ? "large" : ""} ${!loaded && !failed ? "spa-loading" : ""}`}
    >
      {!failed && (animal.source_metadata?.thumbnail || animal.hasSpaPhoto) ? (
        <img
          ref={img}
          loading={loading}
          src={`/api/animals/${animal.id}/source-photo?w=${large ? 1280 : compact ? 320 : 640}&v=${encodeURIComponent(
            String(animal.source_metadata?.thumbnail || "")
              .split("")
              .reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0) >>>
              0,
          )}${attempt ? `&retry=${attempt}` : ""}`}
          alt={`Photo du site SPA : ${animal.name}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (attempt < 2) setWaiting(true);
            else setFailed(true);
          }}
        />
      ) : (
        <Camera size={32} />
      )}
      {!loaded &&
        !failed &&
        (animal.source_metadata?.thumbnail || animal.hasSpaPhoto) && (
          <LoaderCircle
            className="spa-load-spinner spin"
            size={22}
            aria-label="Chargement de la photo SPA"
          />
        )}
      {watermark && !compact && loaded && (
        <i className="spa-reference-mark" aria-hidden="true">
          <Globe size={14} />
        </i>
      )}
      <span>
        <Globe size={12} />
        {large ? "Photo du site SPA · aucune photo locale" : "Source SPA"}
      </span>
    </span>
  );
}
