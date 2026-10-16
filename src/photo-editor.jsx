import { useState, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  RotateCw,
  FlipHorizontal,
  Undo2,
  Redo2,
  SlidersHorizontal,
  FolderInput,
  Crop,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui.jsx";
import { api, bytes } from "./api.js";
import {
  photoDefaults,
  cropForAspect,
  renderEditedPhoto,
  photoPresets,
  applyPhotoPreset,
} from "../shared/photo-edit.mjs";
const ranges = [
  ["exposure", "Exposition", -3, 3, 0.01, " EV"],
  ["contrast", "Contraste", -70, 100, 1, ""],
  ["highlights", "Hautes lumières", -100, 100, 1, ""],
  ["shadows", "Ombres", -100, 100, 1, ""],
  ["saturation", "Saturation", 0, 200, 1, "%"],
  ["temperature", "Température", -100, 100, 1, ""],
];
const advancedRanges = [
  ["vibrance", "Vibrance", -100, 100, 1, ""],
  ["tint", "Teinte · vert / magenta", -100, 100, 1, ""],
  ["sharpness", "Détail", 0, 100, 1, "%"],
  ["fade", "Noirs mats", 0, 70, 1, "%"],
  ["glamour", "Glamour · lumière diffuse", 0, 100, 1, "%"],
  ["vignette", "Vignettage", 0, 100, 1, "%"],
  ["vignetteSize", "Étendue du vignettage", 20, 90, 1, "%"],
];
export default function PhotoEditor({ initial, canEdit, user, notify }) {
  const [file, setFile] = useState(null),
    [edit, setEdit] = useState(structuredClone(photoDefaults)),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [histogram, setHistogram] = useState([]),
    [size, setSize] = useState(null),
    [before, setBefore] = useState(false),
    [format, setFormat] = useState("jpeg"),
    [quality, setQuality] = useState(92),
    [draw, setDraw] = useState(false),
    [ratio, setRatio] = useState("original"),
    [advanced, setAdvanced] = useState(false),
    [look, setLook] = useState("neutral"),
    [strength, setStrength] = useState(100),
    [libraryId, setLibraryId] = useState(null),
    [previewVersion, setPreviewVersion] = useState(0);
  const canvas = useRef(),
    input = useRef(),
    worker = useRef(),
    source = useRef(),
    jobs = useRef(new Map()),
    sequence = useRef(0),
    history = useRef([]),
    redo = useRef([]),
    last = useRef(edit),
    drag = useRef(),
    previewSeq = useRef(0),
    previewLatest = useRef(null),
    previewRunning = useRef(false),
    previewFrame = useRef(null),
    mounted = useRef(true);
  const update = (next, remember = true) =>
    setEdit((prev) => {
      const value =
        typeof next === "function" ? next(prev) : { ...prev, ...next };
      if (remember) {
        history.current.push(prev);
        if (history.current.length > 50) history.current.shift();
        redo.current = [];
      }
      last.current = value;
      return value;
    });
  useEffect(() => {
    mounted.current = true;
    if (
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined"
    ) {
      const w = new Worker(new URL("./photo-worker.js", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = ({ data }) => {
        const task = jobs.current.get(data.id);
        if (!task) {
          data.bitmap?.close();
          return;
        }
        jobs.current.delete(data.id);
        data.error ? task.reject(Error(data.error)) : task.resolve(data);
      };
      w.onerror = () => {
        for (const task of jobs.current.values())
          task.reject(
            Error("Le moteur photo a été interrompu. Rechargez la photo."),
          );
        jobs.current.clear();
      };
    }
    return () => {
      mounted.current = false;
      previewLatest.current = null;
      cancelAnimationFrame(previewFrame.current);
      worker.current?.terminate();
      for (const task of jobs.current.values())
        task.reject(Error("Éditeur fermé."));
      source.current?.close();
    };
  }, []);
  function request(type, options, settings, bitmap) {
    if (!worker.current)
      return type === "load"
        ? Promise.resolve()
        : renderEditedPhoto(
            (w, h) =>
              Object.assign(document.createElement("canvas"), {
                width: w,
                height: h,
              }),
            source.current,
            options,
            settings,
          );
    const id = ++sequence.current;
    return new Promise((resolve, reject) => {
      jobs.current.set(id, { resolve, reject });
      worker.current.postMessage(
        { id, type, options, settings, bitmap },
        bitmap ? [bitmap] : [],
      );
    });
  }
  async function loadPhoto(chosen, sourceId = null) {
    if (!chosen) return;
    setBusy("load");
    setError("");
    setReady(false);
    previewSeq.current++;
    try {
      if (
        chosen.size > 30 * 1024 ** 2 ||
        !/^image\/(jpeg|png|webp|avif)$/.test(chosen.type)
      )
        throw Error("Utilisez JPEG, PNG, WebP ou AVIF, jusqu’à 30 Mo.");
      const bitmap = await createImageBitmap(chosen, {
        imageOrientation: "from-image",
      });
      if (
        bitmap.width * bitmap.height > 40_000_000 ||
        Math.max(bitmap.width, bitmap.height) > 12000
      ) {
        bitmap.close();
        throw Error("Photo limitée à 40 mégapixels et 12 000 px par côté.");
      }
      const dimensions = { width: bitmap.width, height: bitmap.height };
      source.current?.close();
      source.current = worker.current ? null : bitmap;
      await request("load", null, null, worker.current ? bitmap : undefined);
      setFile(chosen);
      setLibraryId(sourceId);
      setSize(dimensions);
      history.current = [];
      redo.current = [];
      setEdit(structuredClone(photoDefaults));
      last.current = structuredClone(photoDefaults);
      setRatio("original");
      setLook("neutral");
      setStrength(100);
      setReady(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }
  useEffect(() => {
    if (!initial?.photoId) return;
    if (user?.role !== "admin") {
      setError(
        "La retouche des photos de la bibliothèque est réservée aux administrateurs. Vous pouvez ouvrir votre propre fichier.",
      );
      return;
    }
    let alive = true;
    setBusy("load");
    fetch(`/api/photos/${initial.photoId}/edit-source`, {
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (!r.ok)
          throw Error("Photo inaccessible. Connectez-vous à votre compte.");
        const blob = await r.blob();
        if (alive)
          await loadPhoto(
            new File([blob], initial.filename || "photo-anipic.jpg", {
              type: blob.type,
            }),
            initial.photoId,
          );
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setBusy("");
        }
      });
    return () => {
      alive = false;
    };
  }, [initial?.photoId, user?.role]);
  useEffect(() => {
    if (!ready || !canvas.current) {
      previewLatest.current = null;
      return;
    }
    previewLatest.current = {
      options: edit,
      before,
      generation: previewSeq.current,
    };
    async function pump() {
      previewFrame.current = null;
      if (previewRunning.current || !previewLatest.current || !mounted.current)
        return;
      const task = previewLatest.current;
      previewLatest.current = null;
      previewRunning.current = true;
      try {
        const result = await request("render", task.options, {
          preview: true,
          before: task.before,
        });
        if (
          mounted.current &&
          task.generation === previewSeq.current &&
          canvas.current
        ) {
          const c = canvas.current;
          c.width = result.bitmap?.width || result.canvas.width;
          c.height = result.bitmap?.height || result.canvas.height;
          c.getContext("2d").drawImage(result.bitmap || result.canvas, 0, 0);
          setHistogram(result.histogram);
          setPreviewVersion((v) => v + 1);
        }
        result.bitmap?.close();
      } catch (e) {
        if (mounted.current) setError(e.message);
      } finally {
        previewRunning.current = false;
        if (previewLatest.current && mounted.current)
          previewFrame.current = requestAnimationFrame(pump);
      }
    }
    if (!previewRunning.current && previewFrame.current == null)
      previewFrame.current = requestAnimationFrame(pump);
  }, [ready, edit, before]);
  function undo(direction) {
    const from = direction === "undo" ? history : redo,
      to = direction === "undo" ? redo : history;
    if (!from.current.length) return;
    const value = from.current.pop();
    to.current.push(edit);
    setEdit(value);
    last.current = value;
    setLook("custom");
  }
  const oriented = size
    ? {
        width: edit.rotation % 180 ? size.height : size.width,
        height: edit.rotation % 180 ? size.width : size.height,
      }
    : null;
  function preset(value) {
    setRatio(value);
    update({
      crop: cropForAspect(oriented.width, oriented.height, Number(value) || 0),
    });
  }
  function point(e) {
    const box = canvas.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    };
  }
  function startCrop(e) {
    if (!ready || busy) return;
    const p = point(e),
      c = edit.crop;
    let mode = "move",
      corner = "";
    if (draw) mode = "draw";
    else {
      const corners = [
        ["tl", c.x, c.y],
        ["tr", c.x + c.w, c.y],
        ["bl", c.x, c.y + c.h],
        ["br", c.x + c.w, c.y + c.h],
      ];
      corner =
        corners.find(
          ([, x, y]) => Math.abs(p.x - x) < 0.06 && Math.abs(p.y - y) < 0.06,
        )?.[0] || "";
      if (corner) mode = "resize";
      else if (p.x < c.x || p.y < c.y || p.x > c.x + c.w || p.y > c.y + c.h)
        mode = "draw";
    }
    drag.current = { p, c, mode, corner, previous: edit };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveCrop(e) {
    const d = drag.current;
    if (!d) return;
    const p = point(e),
      dx = p.x - d.p.x,
      dy = p.y - d.p.y;
    let c;
    if (d.mode === "move")
      c = {
        ...d.c,
        x: Math.max(0, Math.min(1 - d.c.w, d.c.x + dx)),
        y: Math.max(0, Math.min(1 - d.c.h, d.c.y + dy)),
      };
    else if (d.mode === "draw")
      c = {
        x: Math.min(p.x, d.p.x),
        y: Math.min(p.y, d.p.y),
        w: Math.max(0.02, Math.abs(dx)),
        h: Math.max(0.02, Math.abs(dy)),
      };
    else {
      let x = d.c.x,
        y = d.c.y,
        right = x + d.c.w,
        bottom = y + d.c.h;
      if (d.corner.includes("l"))
        x = Math.min(right - 0.02, Math.max(0, x + dx));
      else right = Math.max(x + 0.02, Math.min(1, right + dx));
      if (d.corner.includes("t"))
        y = Math.min(bottom - 0.02, Math.max(0, y + dy));
      else bottom = Math.max(y + 0.02, Math.min(1, bottom + dy));
      c = { x, y, w: right - x, h: bottom - y };
    }
    c.w = Math.min(c.w, 1 - c.x);
    c.h = Math.min(c.h, 1 - c.y);
    update((prev) => ({ ...prev, crop: c }), false);
    if (d.mode !== "move") setRatio("free");
  }
  function finishCrop() {
    if (!drag.current) return;
    history.current.push(drag.current.previous);
    if (history.current.length > 50) history.current.shift();
    redo.current = [];
    drag.current = null;
    setDraw(false);
  }
  async function output(save = false) {
    if (libraryId && user?.role !== "admin") {
      setError("Retouche de bibliothèque réservée aux administrateurs.");
      return;
    }
    setBusy(save ? "save" : "export");
    setError("");
    try {
      const result = await request("render", edit, {
          format: "image/" + format,
          quality: quality / 100,
        }),
        name =
          (file.name.replace(/\.[^.]+$/, "") || "photo") +
          "-retouche." +
          (format === "jpeg" ? "jpg" : format);
      if (save) {
        const body = new FormData();
        body.append(
          "photo",
          new File([result.blob], name, { type: result.blob.type }),
        );
        await api(libraryId ? `/photos/${libraryId}/edits` : "/inbox/photos", {
          method: "POST",
          body,
        });
        notify("Retouche enregistrée dans Photos à trier, en privé.");
      } else {
        const url = URL.createObjectURL(result.blob),
          link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        notify(
          `Photo exportée · ${result.width} × ${result.height} px · ${bytes(result.blob.size)}`,
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const slider = ([key, label, min, max, step, unit]) => (
    <label key={key} className="photo-adjustment">
      <span>
        {label}
        <output>
          {edit[key]}
          {unit}
        </output>
      </span>
      <input
        aria-label={label}
        disabled={!!busy}
        type="range"
        min={min}
        max={max}
        step={step}
        value={edit[key]}
        onPointerDown={() => {
          history.current.push(last.current);
          if (history.current.length > 50) history.current.shift();
          redo.current = [];
        }}
        onChange={(e) => {
          setLook("custom");
          update({ [key]: +e.target.value }, false);
        }}
        onKeyDown={(e) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(e.key)
          ) {
            history.current.push(last.current);
            if (history.current.length > 50) history.current.shift();
            redo.current = [];
          }
        }}
      />
    </label>
  );
  return (
    <div className="photo-editor">
      <div className="page-heading">
        <h1>Éditeur photo</h1>
        <span className="editor-live" data-preview-version={previewVersion}>
          <Radio size={13} /> Aperçu en direct
        </span>
        <Button
          icon={Upload}
          disabled={!!busy}
          onClick={() => input.current.click()}
        >
          Ouvrir une photo
        </Button>
        <input
          ref={input}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => loadPhoto(e.target.files[0])}
        />
      </div>
      {!ready ? (
        <div
          className="editor-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) loadPhoto(e.dataTransfer.files[0]);
          }}
        >
          <ImageIcon size={40} />
          <h2>
            {busy
              ? "Chargement de la photo…"
              : "Glisser une photo ou ouvrir un fichier"}
          </h2>
          <p>JPEG, PNG, WebP, AVIF · retouche locale dans votre navigateur</p>
          <Button variant="secondary" onClick={() => input.current.click()}>
            Choisir une photo
          </Button>
        </div>
      ) : (
        <div className="editor-workspace">
          <section className="editor-view">
            <div className="editor-toolbar">
              <span title={file.name}>{file.name}</span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Annuler la retouche"
                  disabled={!history.current.length || !!busy}
                  onClick={() => undo("undo")}
                >
                  <Undo2 size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Rétablir la retouche"
                  disabled={!redo.current.length || !!busy}
                  onClick={() => undo("redo")}
                >
                  <Redo2 size={18} />
                </button>
                <button
                  className={`button secondary ${before ? "active" : ""}`}
                  onPointerDown={() => setBefore(true)}
                  onPointerUp={() => setBefore(false)}
                  onPointerLeave={() => setBefore(false)}
                  onKeyDown={(e) => {
                    if (e.key === " ") setBefore(true);
                  }}
                  onKeyUp={() => setBefore(false)}
                >
                  Maintenir : avant
                </button>
              </div>
            </div>
            <div className="editor-stage">
              <div
                className="editor-image-wrap"
                style={{
                  aspectRatio: `${oriented.width} / ${oriented.height}`,
                  width: `min(100%, calc(${oriented.width / oriented.height} * var(--editor-photo-height, 65vh)))`,
                }}
                onPointerDown={startCrop}
                onPointerMove={moveCrop}
                onPointerUp={finishCrop}
                onPointerCancel={finishCrop}
              >
                <canvas ref={canvas} />
                <div
                  className="editor-crop"
                  style={{
                    left: edit.crop.x * 100 + "%",
                    top: edit.crop.y * 100 + "%",
                    width: edit.crop.w * 100 + "%",
                    height: edit.crop.h * 100 + "%",
                  }}
                >
                  <i />
                  <i />
                  <i />
                  <i />
                  <span />
                  <span />
                </div>
              </div>
            </div>
            <div className="editor-caption">
              <span>
                {Math.round(oriented.width * edit.crop.w)} ×{" "}
                {Math.round(oriented.height * edit.crop.h)} px
              </span>
              <span>Déplacez le cadre ou ses coins pour recadrer.</span>
            </div>
          </section>
          <aside className="editor-controls panel">
            <div className="photo-presets">
              <h2>
                <Sparkles size={17} /> Presets
              </h2>
              <div className="photo-preset-grid">
                {photoPresets.map((p) => (
                  <button
                    key={p.id}
                    className={look === p.id ? "selected" : ""}
                    aria-pressed={look === p.id}
                    disabled={!!busy}
                    onClick={() => {
                      setLook(p.id);
                      setStrength(100);
                      update(applyPhotoPreset(edit, p.id));
                    }}
                  >
                    <i style={{ "--preset-color": p.color }} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
              {look !== "neutral" && look !== "custom" && (
                <label className="photo-adjustment">
                  <span>
                    Intensité du preset<output>{strength}%</output>
                  </span>
                  <input
                    aria-label="Intensité du preset"
                    type="range"
                    min="0"
                    max="100"
                    value={strength}
                    onChange={(e) => {
                      const n = +e.target.value;
                      setStrength(n);
                      update(applyPhotoPreset(edit, look, n));
                    }}
                  />
                </label>
              )}
            </div>
            <div className="editor-histogram">
              <svg viewBox="0 0 256 60" aria-label="Histogramme de luminosité">
                {histogram.map((v, i) => (
                  <rect
                    key={i}
                    x={i * 4}
                    y={60 - (v / Math.max(...histogram, 1)) * 56}
                    width="3"
                    height={(v / Math.max(...histogram, 1)) * 56}
                  />
                ))}
              </svg>
            </div>
            <h2>
              <SlidersHorizontal size={17} /> Lumière & couleur
            </h2>
            {ranges.map(slider)}
            <div className="photo-advanced">
              <button
                className="photo-advanced-toggle"
                aria-expanded={advanced}
                onClick={() => setAdvanced(!advanced)}
              >
                <SlidersHorizontal size={16} />
                <span>Mode avancé</span>
                <ChevronDown size={16} />
              </button>
              {advanced && (
                <div className="photo-advanced-sliders">
                  {advancedRanges.map(slider)}
                </div>
              )}
            </div>
            <h2>
              <Crop size={17} /> Cadrage
            </h2>
            <select
              aria-label="Format de recadrage"
              value={ratio}
              onChange={(e) => preset(e.target.value)}
            >
              <option value="original">Photo entière</option>
              <option value="free">Libre</option>
              <option value="1">Carré · 1:1</option>
              <option value="0.8">Portrait · 4:5</option>
              <option value="0.5625">Story · 9:16</option>
              <option value="1.7777777778">Paysage · 16:9</option>
            </select>
            <div className="editor-row">
              <Button
                variant="secondary"
                icon={RotateCw}
                disabled={!!busy}
                onClick={() => {
                  update({
                    rotation: (edit.rotation + 90) % 360,
                    crop: { x: 0, y: 0, w: 1, h: 1 },
                  });
                  setRatio("original");
                }}
              >
                90°
              </Button>
              <Button
                variant="secondary"
                icon={FlipHorizontal}
                disabled={!!busy}
                onClick={() => update({ mirror: !edit.mirror })}
              >
                Miroir
              </Button>
              <Button
                variant="secondary"
                icon={Crop}
                onClick={() => {
                  setDraw(true);
                  notify(
                    "Faites glisser sur la photo pour dessiner un nouveau cadre.",
                  );
                }}
              >
                Tracer
              </Button>
            </div>
            <Button
              variant="quiet"
              icon={RefreshCw}
              disabled={!!busy}
              onClick={() => {
                update(structuredClone(photoDefaults));
                setRatio("original");
                setLook("neutral");
                setStrength(100);
              }}
            >
              Réinitialiser
            </Button>
            <h2>Export</h2>
            <div className="editor-row">
              <select
                aria-label="Format d’export photo"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
              </select>
              {format !== "png" && (
                <label>
                  Qualité {quality}%
                  <input
                    type="range"
                    min="60"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(+e.target.value)}
                  />
                </label>
              )}
            </div>
            <Button icon={Download} disabled={!!busy} onClick={() => output()}>
              {busy === "export" ? "Export…" : "Télécharger la retouche"}
            </Button>
            {canEdit && (
              <Button
                variant="secondary"
                icon={FolderInput}
                disabled={!!busy}
                onClick={() => output(true)}
              >
                {busy === "save"
                  ? "Enregistrement…"
                  : "Enregistrer dans Photos à trier"}
              </Button>
            )}
          </aside>
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <p className="fineprint editor-security-note">
        <ShieldCheck size={14} />
        Les originaux restent intacts. Le fichier ouvert reste dans le
        navigateur ; seul « Enregistrer dans Photos à trier » envoie la retouche
        au serveur.
      </p>
    </div>
  );
}
