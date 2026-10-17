import { useEffect, useState } from "react";
import { prepareImages as loadImages } from "../shared/load-images.mjs";
import { LoaderCircle, RefreshCw, ImageOff } from "lucide-react";
import { Button } from "./ui.jsx";
const decoded = new Map();
function decodeImage(url) {
  const saved = decoded.get(url);
  if (saved && Date.now() - saved.at < 5 * 60000) return saved.promise;
  const promise = new Promise((resolve, reject) => {
    const img = new Image(),
      timer = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(Error("Délai de chargement dépassé."));
      }, 25000);
    img.onload = async () => {
      clearTimeout(timer);
      if (!img.naturalWidth) return reject(Error("Image vide."));
      try {
        await img.decode?.();
        resolve();
      } catch {
        reject(Error("Image illisible."));
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(Error("Image temporairement indisponible."));
    };
    img.src = url;
  }).catch((e) => {
    decoded.delete(url);
    throw e;
  });
  decoded.set(url, { promise, at: Date.now() });
  // Bound session memory while keeping recent, already-decoded images reusable.
  if (decoded.size > 400) decoded.delete(decoded.keys().next().value);
  return promise;
}
export async function prepareImages(
  urls,
  { load = decodeImage, onProgress = () => {}, concurrency = 4 } = {},
) {
  return loadImages(urls, { load, onProgress, concurrency });
}
export function useImageReadiness(urls) {
  const key = JSON.stringify([...new Set(urls.filter(Boolean))].sort());
  const [state, setState] = useState({ key: "", done: 0, failed: [] }),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ key, done: 0, failed: [] });
    prepareImages(JSON.parse(key), {
      onProgress: (r) => {
        if (alive) setState({ key, ...r });
      },
    }).then((r) => {
      if (alive) setState({ key, ...r });
    });
    return () => {
      alive = false;
    };
  }, [key, attempt]);
  const total = JSON.parse(key).length,
    matched = state.key === key;
  return {
    ready: !total || (matched && state.done === total && !state.failed.length),
    done: matched ? state.done : 0,
    total,
    failed: matched ? state.failed : [],
    retry: () => setAttempt((v) => v + 1),
  };
}
export function AssetLoading({ state }) {
  return (
    <div
      className="asset-loading"
      role="status"
      aria-live="polite"
      aria-busy={!state.failed.length}
    >
      {state.failed.length ? (
        <ImageOff size={30} />
      ) : (
        <LoaderCircle size={30} className="spin" />
      )}
      <strong>
        {state.failed.length
          ? "Certaines photos ne sont pas disponibles"
          : "Préparation des photos"}
      </strong>
      <span>
        {state.done} / {state.total} chargée(s)
        {state.failed.length ? ` · ${state.failed.length} à réessayer` : ""}
      </span>
      <progress value={state.done} max={state.total || 1} />
      {state.failed.length ? (
        <>
          <small>
            La lecture attend les images pour éviter les cadres vides.
          </small>
          <Button icon={RefreshCw} variant="secondary" onClick={state.retry}>
            Réessayer les photos
          </Button>
        </>
      ) : (
        <small>
          La première ouverture peut prendre un instant. Les aperçus sont
          ensuite réutilisés.
        </small>
      )}
    </div>
  );
}
export function ImageReady({ urls, children }) {
  const state = useImageReadiness(urls);
  return state.ready ? children : <AssetLoading state={state} />;
}
