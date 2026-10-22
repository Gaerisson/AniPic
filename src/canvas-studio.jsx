import "./canvas314.css";
import { useEffect, useRef, useState } from "react";
import {
  Canvas,
  FabricObject,
  FabricImage,
  ActiveSelection,
  Textbox,
  Rect,
  Circle,
  Triangle,
  Gradient,
  Shadow,
} from "fabric";
import {
  Undo2,
  Redo2,
  Type,
  ImagePlus,
  Layers,
  Copy,
  Trash2,
  Download,
  Save,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Plus,
  Upload,
  Palette,
  Link2,
  Unlink,
} from "lucide-react";
import { api, apiBlob, imageUrl } from "./api.js";
import { Button, Modal } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
import {
  canvasFormats,
  validateCanvasDocument,
  canvasHistoryPush,
  canonicalCanvasDocument,
} from "../shared/canvas-document.mjs";
import { canvasDraft } from "./canvas-storage.js";
import {
  canvasTemplates,
  canvasTemplateDocument,
} from "../shared/canvas-templates.mjs";

FabricObject.customProperties = [
  "name",
  "animalId",
  "sourceKind",
  "photoId",
  "ratioLocked",
];
const origin = { originX: "left", originY: "top" };
const palette = {
  refuge: ["#ece0ca", "#f47721", "#514838"],
  glass: ["#192b46", "#7ee1d1", "#f7f5ef"],
  christmas: ["#18362c", "#e9be6b", "#fff9ef"],
  autumn: ["#35243c", "#ff9662", "#fff0d5"],
  spring: ["#e8f0dc", "#667d50", "#243a2a"],
};
const readData = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
const download = (blob, name) => {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
const label = (object) =>
  object.name ||
  (object.type === "textbox"
    ? object.text.slice(0, 28)
    : object.type === "image"
      ? "Image"
      : "Forme");
function DimensionField({ name, value, commit }) {
  const [draft, setDraft] = useState(String(Math.round(value))),
    [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value)));
  }, [value, editing]);
  return (
    <label>
      {name}
      <input
        type="number"
        min="10"
        max="8000"
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false);
          const parsed = Number(draft);
          if (Number.isFinite(parsed) && parsed > 0) commit(parsed);
          else setDraft(String(Math.round(value)));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export default function CanvasStudio({
  user,
  overview,
  notify = () => {},
  workspace = "canvas",
}) {
  const element = useRef(),
    stage = useRef(),
    canvas = useRef(),
    templateId = useRef(""),
    dimensions = useRef({ width: 1920, height: 720 });
  const history = useRef([]),
    future = useRef([]),
    restoring = useRef(false),
    alive = useRef(true),
    saveTimer = useRef(),
    persist = useRef(),
    project = useRef(null),
    scale = useRef(1),
    zoomRef = useRef(1);
  const [title, setTitle] = useState("Mon visuel"),
    [size, setSize] = useState(dimensions.current),
    [objects, setObjects] = useState([]),
    [selection, setSelection] = useState(null),
    [tab, setTab] = useState("templates"),
    [zoom, setZoom] = useState(1),
    [theme, setTheme] = useState("refuge"),
    [background, setBackground] = useState("#ece0ca"),
    [projects, setProjects] = useState([]),
    [animals, setAnimals] = useState([]),
    [query, setQuery] = useState(""),
    [source, setSource] = useState("auto"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("Brouillon local"),
    [shared, setShared] = useState(false),
    [tick, setTick] = useState(0),
    [pendingTemplate, setPendingTemplate] = useState(null),
    [expanded, setExpanded] = useState(false);
  const draftKey =
      (workspace === "canvas" ? "draft:" : "banner:") + (user?.id || "visitor"),
    canSave = ["admin", "agent", "editor", "volunteer"].includes(user?.role);
  const snapshot = () =>
    canonicalCanvasDocument(
      {
        schema: 1,
        template: templateId.current,
        ...dimensions.current,
        scene: canvas.current.toJSON(),
      },
      location.origin,
    );
  const refresh = () => {
    const c = canvas.current;
    if (!c) return;
    setObjects([...c.getObjects()].reverse());
    setSelection(c.getActiveObject() || null);
    c.uniformScaling = c.getActiveObject()?.ratioLocked !== false;
    for (const object of [...c.getObjects(), c.getActiveObject()].filter(
      Boolean,
    )) {
      const free = object.ratioLocked === false;
      object.setControlsVisibility({ ml: free, mr: free, mt: free, mb: free });
      object.set({
        lockScalingFlip: true,
        lockSkewingX: true,
        lockSkewingY: true,
      });
    }
    setTick((t) => t + 1);
  };
  const fit = () => {
    const c = canvas.current;
    if (!c || !stage.current) return;
    const s =
      Math.min(
        (stage.current.clientWidth - 48) / dimensions.current.width,
        Math.max(230, (stage.current.clientHeight || 500) - 48) /
          dimensions.current.height,
        1,
      ) * zoomRef.current;
    scale.current = Math.max(0.03, s);
    c.setDimensions({
      width: Math.round(dimensions.current.width * scale.current),
      height: Math.round(dimensions.current.height * scale.current),
    });
    c.setZoom(scale.current);
    c.requestRenderAll();
  };
  const record = () => {
    if (!canvas.current || restoring.current) return;
    const doc = snapshot();
    history.current = canvasHistoryPush(history.current, JSON.stringify(doc));
    future.current = [];
    refresh();
    setSaved("Modifications en cours…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist.current?.(doc), 600);
  };
  persist.current = async (doc) => {
    try {
      await canvasDraft(draftKey, {
        title,
        shared,
        document: doc,
        project: project.current,
      });
      if (alive.current) setSaved("Brouillon enregistré sur cet appareil");
    } catch {
      if (alive.current)
        setSaved(
          "Brouillon local indisponible : enregistrez ou exportez le projet.",
        );
    }
  };
  const restore = async (doc) => {
    doc = canonicalCanvasDocument(doc, location.origin);
    validateCanvasDocument(doc);
    templateId.current = canvasTemplates.some(([id]) => id === doc.template)
      ? doc.template
      : "";
    restoring.current = true;
    try {
      await canvas.current.loadFromJSON(doc.scene);
      dimensions.current = { width: doc.width, height: doc.height };
      setSize(dimensions.current);
      setBackground(
        typeof canvas.current.backgroundColor === "string"
          ? canvas.current.backgroundColor
          : "#ffffff",
      );
      fit();
      refresh();
    } finally {
      restoring.current = false;
    }
  };
  const run = async (action) => {
    if (busy) return;
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message || "Opération impossible.");
    } finally {
      if (alive.current) setBusy("");
    }
  };
  const assertInsert = (inserted, removed = []) => {
    const doc = snapshot(),
      current = canvas.current.getObjects();
    doc.scene.objects = doc.scene.objects
      .filter((_, index) => !removed.includes(current[index]))
      .concat(inserted.map((object) => object.toObject()));
    validateCanvasDocument(canonicalCanvasDocument(doc, location.origin));
  };
  const add = (object, { hide = [] } = {}) => {
    try {
      assertInsert([object]);
    } catch (error) {
      setError(error.message);
      return false;
    }
    hide.forEach((item) => item.set({ visible: false }));
    canvas.current.add(object);
    canvas.current.setActiveObject(object);
    record();
    canvas.current.requestRenderAll();
  };
  const patch = (values) => {
    if (!selection) return;
    selection.set(values);
    selection.setCoords();
    canvas.current.requestRenderAll();
    record();
  };
  const resizeSelection = (axis, value) => {
    if (!selection || !Number.isFinite(value) || value <= 0) return;
    const ratio =
      Math.min(8000, Math.max(10, value)) /
      (axis === "width"
        ? selection.getScaledWidth()
        : selection.getScaledHeight());
    patch(
      selection.ratioLocked !== false
        ? { scaleX: selection.scaleX * ratio, scaleY: selection.scaleY * ratio }
        : axis === "width"
          ? { scaleX: selection.scaleX * ratio }
          : { scaleY: selection.scaleY * ratio },
    );
  };
  const remove = () => {
    const c = canvas.current;
    c.remove(...c.getActiveObjects());
    c.discardActiveObject();
    record();
  };
  const duplicate = () =>
    run(async () => {
      const c = canvas.current,
        originals = [...c.getActiveObjects()];
      if (!originals.length) return;
      // Discarding the temporary selection restores each object's document
      // coordinates. The selection itself must never be saved as a layer.
      c.discardActiveObject();
      const clones = await Promise.all(
        originals.map(async (object) => {
          const clone = await object.clone();
          clone.set({ left: object.left + 30, top: object.top + 30 });
          return clone;
        }),
      );
      assertInsert(clones);
      c.add(...clones);
      c.setActiveObject(
        clones.length === 1
          ? clones[0]
          : new ActiveSelection(clones, { canvas: c }),
      );
      record();
      c.requestRenderAll();
    });
  const text = (value = "Une rencontre peut tout changer.", options = {}) =>
    new Textbox(value, {
      ...origin,
      left: size.width * 0.08,
      top: size.height * 0.25,
      width: size.width * 0.65,
      fontFamily: "Arial",
      fontSize: Math.round(size.width / 24),
      fill: palette[theme][2],
      ...options,
    });
  const image = async (src, metadata = {}) => {
    const bitmap = await FabricImage.fromURL(
      src,
      {},
      { ...origin, ...metadata },
    );
    const duo = templateId.current === "duo";
    const imageCount = canvas.current
      .getObjects()
      .filter(
        (object) => object.type === "image" && object.name !== "Logo SPA",
      ).length;
    const ratio = Math.min(
      (dimensions.current.width * (duo ? 0.22 : 0.3)) / bitmap.width,
      (dimensions.current.height * 0.55) / bitmap.height,
      1,
    );
    bitmap.scale(ratio);
    bitmap.set({
      left:
        dimensions.current.width *
          (duo ? (imageCount % 2 ? 0.835 : 0.165) : 0.82) -
        bitmap.getScaledWidth() / 2,
      top: dimensions.current.height * (duo ? 0.28 : 0.36),
    });
    const slot = (imageCount % 2) + 1;
    add(bitmap, {
      hide: duo
        ? canvas.current
            .getObjects()
            .filter((object) =>
              ["Emplacement photo " + slot, "Repère photo " + slot].includes(
                object.name,
              ),
            )
        : [],
    });
    return bitmap;
  };
  const importPhoto = (file) =>
    run(async () => {
      if (
        !file ||
        !/^image\/(png|jpeg|webp)$/.test(file.type) ||
        file.size > 30e6
      )
        throw Error("Choisissez un PNG, JPEG ou WebP de moins de 30 Mo.");
      setBusy("Import de l’image…");
      const bitmap = await createImageBitmap(file);
      const output = document.createElement("canvas"),
        ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      output.width = Math.round(bitmap.width * ratio);
      output.height = Math.round(bitmap.height * ratio);
      output
        .getContext("2d")
        .drawImage(bitmap, 0, 0, output.width, output.height);
      bitmap.close();
      await image(
        output.toDataURL(
          file.type === "image/png" ? "image/png" : "image/jpeg",
          0.9,
        ),
        { name: file.name },
      );
    });
  const template = (type) =>
    run(async () => {
      await restore(
        canvasTemplateDocument(type, {
          ...dimensions.current,
          colors: palette[theme],
          refuge: overview?.refugeName || "Refuge de Morée",
        }),
      );
      record();
      canvas.current.requestRenderAll();
    });
  const requestTemplate = (type) => {
    if (canvas.current.getObjects().length) setPendingTemplate(type);
    else template(type);
  };
  const historyMove = (direction) =>
    run(async () => {
      if (direction < 0 && history.current.length > 1) {
        future.current.push(history.current.pop());
        await restore(JSON.parse(history.current.at(-1)));
      } else if (direction > 0 && future.current.length) {
        const next = future.current.pop();
        history.current.push(next);
        await restore(JSON.parse(next));
      }
      await persist.current(snapshot());
    });
  const save = (copy) =>
    run(async () => {
      setBusy("Enregistrement…");
      const doc = validateCanvasDocument(snapshot());
      if (!canSave) {
        download(
          new Blob([JSON.stringify({ title, document: doc })], {
            type: "application/json",
          }),
          title + ".anipic.json",
        );
        return;
      }
      const old = copy ? null : project.current;
      const result = await api("/canvas/projects" + (old ? "/" + old.id : ""), {
        method: old ? "PUT" : "POST",
        body: {
          title,
          shared,
          document: doc,
          ...(old ? { revision: old.revision } : {}),
        },
      });
      project.current = result;
      await persist.current(doc);
      setSaved("Projet enregistré dans AniPic");
      setProjects((await api("/canvas/projects")).projects);
      notify("Visuel enregistré.");
    });
  const open = (id) =>
    run(async () => {
      if (!id) return;
      setBusy("Ouverture du projet…");
      const row = await api("/canvas/projects/" + id);
      await restore(row.document);
      project.current = { id: row.id, revision: row.revision };
      setTitle(row.title);
      setShared(Boolean(row.shared));
      history.current = [JSON.stringify(row.document)];
      future.current = [];
      await canvasDraft(draftKey, {
        title: row.title,
        document: row.document,
        shared: Boolean(row.shared),
        project: project.current,
      });
    });
  const exporting = (type) =>
    run(async () => {
      setBusy("Préparation de l’export…");
      const c = canvas.current;
      validateCanvasDocument(snapshot());
      c.discardActiveObject();
      c.requestRenderAll();
      if (type === "json") {
        download(
          new Blob([JSON.stringify({ title, document: snapshot() })], {
            type: "application/json",
          }),
          title + ".anipic.json",
        );
        return;
      }
      const old = [...c.viewportTransform],
        width = c.width,
        height = c.height;
      try {
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
        c.setDimensions(dimensions.current);
        c.renderAll();
        if (type === "svg") {
          const embedded = new Map(),
            escape = (value) =>
              value
                .replaceAll("&", "&amp;")
                .replaceAll('"', "&quot;")
                .replaceAll("<", "&lt;");
          const collect = (object) => {
            if (object.type === "image") {
              const element = object.getElement(),
                raster = document.createElement("canvas");
              raster.width = element.naturalWidth || element.width;
              raster.height = element.naturalHeight || element.height;
              raster.getContext("2d").drawImage(element, 0, 0);
              embedded.set(
                escape(object.getSrc()),
                raster.toDataURL("image/png"),
              );
            }
            object.getObjects?.().forEach(collect);
          };
          c.getObjects().forEach(collect);
          const svg = c.toSVG({}, (markup) => {
            for (const [src, data] of embedded)
              markup = markup.replaceAll(src, data);
            return markup;
          });
          download(new Blob([svg], { type: "image/svg+xml" }), title + ".svg");
        } else {
          const output = c.toCanvasElement(1);
          const blob = await new Promise((resolve) =>
            output.toBlob(resolve, "image/" + type, 0.95),
          );
          if (!blob)
            throw Error(
              "Le navigateur n’a pas pu encoder ce visuel. Essayez le PNG ou un format plus petit.",
            );
          download(blob, title + (type === "jpeg" ? ".jpg" : ".png"));
        }
      } finally {
        c.setDimensions({ width, height });
        c.setViewportTransform(old);
        c.requestRenderAll();
        refresh();
      }
    });
  const cutout = () =>
    run(async () => {
      if (!selection?.animalId)
        throw Error(
          "Sélectionnez une photo d’animal ajoutée depuis la bibliothèque AniPic.",
        );
      setBusy("Préparation du détourage…");
      const target = selection,
        job = await api("/creative/cutouts", {
          method: "POST",
          body: {
            kind: target.sourceKind,
            id: target.photoId || target.animalId,
          },
        });
      const deadline = Date.now() + 610000;
      while (alive.current) {
        const current = await api("/creative/jobs/" + job.id);
        if (current.state === "failed")
          throw Error(current.error || "Détourage impossible.");
        if (current.state === "done") break;
        if (Date.now() > deadline)
          throw Error("Le détourage a dépassé le délai.");
        setBusy(current.stage || "Détourage local…");
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      if (!alive.current) return;
      const blob = await apiBlob("/creative/cutouts/" + job.id + "/render", {
        background: "transparent",
        feather: 0.4,
      });
      const replacement = await FabricImage.fromURL(
        await readData(blob),
        {},
        {
          ...origin,
          left: target.left,
          top: target.top,
          angle: target.angle,
          name: target.name + " détouré",
          animalId: target.animalId,
        },
      );
      replacement.scaleToWidth(target.getScaledWidth());
      assertInsert([replacement], [target]);
      canvas.current.remove(target);
      canvas.current.add(replacement);
      canvas.current.setActiveObject(replacement);
      record();
      canvas.current.requestRenderAll();
    });
  useEffect(() => {
    alive.current = true;
    const c = new Canvas(element.current, {
      preserveObjectStacking: true,
      backgroundColor: "#ece0ca",
      selection: true,
      uniformScaling: true,
      uniScaleKey: null,
    });
    canvas.current = c;
    c.on("object:modified", record);
    c.on("text:changed", record);
    c.on("selection:created", refresh);
    c.on("selection:updated", refresh);
    c.on("selection:cleared", refresh);
    const observer = new ResizeObserver(fit);
    observer.observe(stage.current);
    (async () => {
      try {
        const draft = await canvasDraft(draftKey);
        if (!alive.current) return;
        if (draft) {
          setTitle(draft.title);
          setShared(Boolean(draft.shared));
          project.current = draft.project;
          await restore(draft.document);
        } else {
          fit();
        }
        history.current = [JSON.stringify(snapshot())];
        refresh();
      } catch (e) {
        setError("Restauration du brouillon : " + e.message);
      }
    })();
    const keys = (e) => {
      if (
        !stage.current ||
        busy ||
        e.target.closest("input,textarea,select,[contenteditable=true]") ||
        c.getActiveObject()?.isEditing
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        historyMove(e.shiftKey ? 1 : -1);
      } else if (
        ["Delete", "Backspace"].includes(e.key) &&
        c.getActiveObject()
      ) {
        e.preventDefault();
        remove();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      alive.current = false;
      clearTimeout(saveTimer.current);
      observer.disconnect();
      document.removeEventListener("keydown", keys);
      c.dispose();
      canvas.current = null;
    };
  }, [draftKey]);
  useEffect(() => {
    let active = true;
    if (user)
      api("/canvas/projects")
        .then((d) => active && setProjects(d.projects))
        .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (tab !== "animals") return;
    const controller = new AbortController(),
      timer = setTimeout(
        () =>
          api("/animals?limit=60&sort=name&q=" + encodeURIComponent(query), {
            signal: controller.signal,
          })
            .then((d) => setAnimals(d.items))
            .catch((e) => {
              if (e.name !== "AbortError") setError(e.message);
            }),
        250,
      );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, query]);
  useEffect(() => {
    zoomRef.current = zoom;
    fit();
  }, [zoom]);
  const input = (key, value, min = -10000, max = 10000) => (
    <input
      type="number"
      aria-label={key}
      value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
      min={min}
      max={max}
      onChange={(e) =>
        patch({ [key]: Math.min(max, Math.max(min, Number(e.target.value))) })
      }
    />
  );
  return (
    <div className={`canvas-studio314 ${expanded ? "canvas-expanded" : ""}`}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VOTRE ATELIER VISUEL</div>
          <h1>
            {workspace === "banner" ? "Visuels & bannières" : "Le Canvas"}
          </h1>
          <p>Du premier mot au dernier détail. Déplacez, composez, créez.</p>
        </div>
        <Palette size={32} />
      </div>
      <div className="canvas-projectbar panel">
        <label>
          Nom du projet
          <input
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved("Nom modifié — enregistrez le projet");
            }}
          />
        </label>
        <select
          aria-label="Ouvrir un projet"
          value=""
          onChange={(e) => open(e.target.value)}
        >
          <option value="">Ouvrir un projet enregistré…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.shared ? " · équipe" : ""}
            </option>
          ))}
        </select>
        <Button
          icon={Save}
          loading={busy === "Enregistrement…"}
          disabled={Boolean(busy)}
          onClick={() => save(false)}
        >
          {canSave ? "Enregistrer" : "Exporter le projet"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => save(true)}
          disabled={Boolean(busy)}
        >
          Copie
        </Button>
        {canSave && (
          <label className="canvas-check">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />{" "}
            Partager avec l’équipe
          </label>
        )}
      </div>
      {error && (
        <div className="canvas-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Fermer</button>
        </div>
      )}
      <div className="canvas-toolbar">
        <Button
          variant="secondary"
          onClick={() => {
            setExpanded((v) => !v);
            requestAnimationFrame(fit);
          }}
        >
          {expanded ? "Quitter l’atelier" : "Agrandir l’atelier"}
        </Button>
        <div>
          <Button
            icon={Undo2}
            variant="secondary"
            aria-label="Annuler"
            disabled={history.current.length < 2 || Boolean(busy)}
            onClick={() => historyMove(-1)}
          >
            Annuler
          </Button>
          <Button
            icon={Redo2}
            variant="secondary"
            disabled={!future.current.length || Boolean(busy)}
            onClick={() => historyMove(1)}
          >
            Rétablir
          </Button>
        </div>
        <label>
          Format
          <select
            value={
              canvasFormats.find(
                (f) => f.width === size.width && f.height === size.height,
              )?.id || "custom"
            }
            onChange={(e) => {
              const f = canvasFormats.find((f) => f.id === e.target.value);
              if (!f) return;
              dimensions.current = { width: f.width, height: f.height };
              setSize(dimensions.current);
              fit();
              record();
            }}
          >
            <option value="custom">
              Personnalisé {size.width}×{size.height}
            </option>
            {canvasFormats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zoom
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[0.5, 0.75, 1, 1.5, 2].map((z) => (
              <option key={z} value={z}>
                {z === 1 ? "Ajusté" : Math.round(z * 100) + " %"}
              </option>
            ))}
          </select>
        </label>
        <details className="canvas-exports">
          <summary>
            <Download size={16} /> Exporter
          </summary>
          {["png", "jpeg", "svg", "json"].map((t) => (
            <button
              key={t}
              disabled={Boolean(busy)}
              onClick={() => exporting(t)}
            >
              {t === "json" ? "Projet modifiable" : t.toUpperCase()}
            </button>
          ))}
        </details>
      </div>
      <div className="canvas-workspace" aria-busy={Boolean(busy)}>
        <aside className="canvas-library">
          <nav aria-label="Bibliothèque du Canvas">
            {[
              ["templates", "Modèles"],
              ["objects", "Éléments"],
              ["animals", "Animaux"],
              ["layers", "Calques"],
            ].map(([id, name]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </nav>
          {tab === "templates" && (
            <div className="canvas-library-body">
              <h2>Une belle base, à vous de jouer.</h2>
              <label>
                Ambiance
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  {Object.keys(palette).map((key) => (
                    <option key={key} value={key}>
                      {
                        {
                          refuge: "Refuge SPA",
                          glass: "Verre & lumière",
                          christmas: "Noël",
                          autumn: "Automne / Halloween",
                          spring: "Printemps",
                        }[key]
                      }
                    </option>
                  ))}
                </select>
              </label>
              {canvasTemplates.map(([id, name, help]) => (
                <button
                  className={"canvas-template " + id}
                  key={id}
                  disabled={Boolean(busy)}
                  onClick={() => requestTemplate(id)}
                  style={{
                    background: `linear-gradient(135deg,${palette[theme][0]},${palette[theme][1]})`,
                    color: palette[theme][2],
                  }}
                >
                  <span
                    className="canvas-template-art"
                    data-preset={id}
                    aria-hidden="true"
                  >
                    <i />
                    <b />
                    <em />
                  </span>
                  <strong>{name}</strong>
                  <small>{help}</small>
                </button>
              ))}
              <p>
                Ajoutez ensuite les animaux, puis déplacez chaque élément
                librement.
              </p>
            </div>
          )}
          {tab === "objects" && (
            <div className="canvas-library-body">
              <h2>Ajouter un élément</h2>
              <Button icon={Type} onClick={() => add(text())}>
                Texte
              </Button>
              {[
                [Rect, "Rectangle"],
                [Circle, "Cercle"],
                [Triangle, "Triangle"],
              ].map(([Shape, name]) => (
                <Button
                  key={name}
                  variant="secondary"
                  icon={Plus}
                  onClick={() =>
                    add(
                      new Shape({
                        ...origin,
                        left: size.width * 0.1,
                        top: size.height * 0.1,
                        width: size.width * 0.25,
                        height: size.height * 0.4,
                        radius: size.height * 0.15,
                        fill: palette[theme][1],
                        name,
                      }),
                    )
                  }
                >
                  {name}
                </Button>
              ))}
              <label className="canvas-file">
                <ImagePlus size={18} /> Importer une image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    importPhoto(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button
                variant="secondary"
                onClick={() =>
                  run(() => image("/spa-logo.png", { name: "Logo SPA" }))
                }
              >
                Logo SPA
              </Button>
              <label>
                Couleur de fond
                <input
                  type="color"
                  value={background}
                  onChange={(e) => {
                    setBackground(e.target.value);
                    canvas.current.backgroundColor = e.target.value;
                    record();
                    canvas.current.requestRenderAll();
                  }}
                />
              </label>
              <Button
                variant="secondary"
                onClick={() => {
                  canvas.current.backgroundColor = "";
                  record();
                  canvas.current.requestRenderAll();
                }}
              >
                Fond transparent
              </Button>
              <label className="canvas-file">
                <Upload size={17} /> Ouvrir un fichier projet
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    run(async () => {
                      if (!file || file.size > 11e6)
                        throw Error("Projet trop volumineux.");
                      const value = JSON.parse(await file.text());
                      await restore(value.document || value);
                      setTitle(value.title || "Projet importé");
                      project.current = null;
                      record();
                    });
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
          {tab === "animals" && (
            <div className="canvas-library-body">
              <h2>Les animaux du refuge</h2>
              <input
                placeholder="Chercher un animal…"
                aria-label="Chercher un animal"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label>
                Source de l’image
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="auto">Photo de l’équipe, sinon SPA</option>
                  <option value="spa">Photo du site SPA</option>
                </select>
              </label>
              <div className="canvas-animals">
                {animals.map((a) => {
                  const local = source === "auto" && a.cover_id;
                  return (
                    <button
                      key={a.id}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(async () => {
                          setBusy("Chargement de " + a.name + "…");
                          await image(
                            local
                              ? imageUrl(a.cover_id, 1280)
                              : `/api/animals/${a.id}/source-photo?w=1280`,
                            {
                              name: a.name,
                              animalId: a.id,
                              sourceKind: local ? "local" : "spa",
                              photoId: local ? a.cover_id : "",
                            },
                          );
                        })
                      }
                    >
                      {local ? (
                        <img
                          src={imageUrl(a.cover_id, 320)}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <SpaPhoto animal={a} compact watermark={false} />
                      )}
                      <strong>{a.name}</strong>
                      <small>
                        {local ? "Photo de l’équipe" : "Photo du site SPA"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {tab === "layers" && (
            <div className="canvas-library-body">
              <h2>
                <Layers size={18} /> Les calques
              </h2>
              <p>Du premier plan à l’arrière-plan.</p>
              {objects.map((o, i) => (
                <div
                  className="canvas-layer"
                  key={i}
                  data-active={selection === o}
                >
                  <button
                    onClick={() => {
                      canvas.current.setActiveObject(o);
                      refresh();
                      canvas.current.requestRenderAll();
                    }}
                  >
                    {label(o)}
                  </button>
                  <button
                    title={o.selectable ? "Verrouiller" : "Déverrouiller"}
                    onClick={() => {
                      o.set({
                        selectable: !o.selectable,
                        evented: !o.selectable,
                      });
                      canvas.current.discardActiveObject();
                      record();
                    }}
                  >
                    {o.selectable ? <Unlock size={15} /> : <Lock size={15} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
        <div
          className="canvas-stage"
          ref={stage}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) importPhoto(e.dataTransfer.files[0]);
          }}
        >
          <canvas
            ref={element}
            aria-label="Votre visuel : sélectionnez et déplacez les éléments"
          />
          {busy && (
            <div className="canvas-busy" role="status">
              <Sparkles className="button-spinner" size={19} />
              {busy}
            </div>
          )}
        </div>
        <aside className="canvas-inspector">
          <h2>{selection ? "L’élément sélectionné" : "Votre composition"}</h2>
          {selection ? (
            <>
              <label>
                Nom du calque
                <input
                  value={selection.name || ""}
                  onChange={(e) => patch({ name: e.target.value.slice(0, 80) })}
                />
              </label>
              {selection.type === "textbox" && (
                <>
                  <label>
                    Texte
                    <textarea
                      value={selection.text}
                      onChange={(e) =>
                        patch({ text: e.target.value.slice(0, 4000) })
                      }
                    />
                  </label>
                  <label>
                    Police
                    <select
                      value={selection.fontFamily}
                      onChange={(e) => patch({ fontFamily: e.target.value })}
                    >
                      {[
                        "Arial",
                        "Georgia",
                        "Verdana",
                        "Trebuchet MS",
                        "Courier New",
                      ].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Taille{input("fontSize", selection.fontSize, 8, 800)}
                  </label>
                  <div className="canvas-inspector-row">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        patch({
                          fontWeight:
                            selection.fontWeight === "bold" ? "normal" : "bold",
                        })
                      }
                    >
                      Gras
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        patch({
                          fontStyle:
                            selection.fontStyle === "italic"
                              ? "normal"
                              : "italic",
                        })
                      }
                    >
                      Italique
                    </Button>
                  </div>
                  <label>
                    Alignement
                    <select
                      value={selection.textAlign}
                      onChange={(e) => patch({ textAlign: e.target.value })}
                    >
                      <option value="left">Gauche</option>
                      <option value="center">Centré</option>
                      <option value="right">Droite</option>
                    </select>
                  </label>
                </>
              )}
              {selection.type !== "image" && (
                <label>
                  Couleur
                  <input
                    type="color"
                    value={
                      /^#[\da-f]{6}$/i.test(selection.fill)
                        ? selection.fill
                        : "#f47721"
                    }
                    onChange={(e) => patch({ fill: e.target.value })}
                  />
                </label>
              )}
              <div className="canvas-inspector-row">
                <label>X{input("left", selection.left)}</label>
                <label>Y{input("top", selection.top)}</label>
              </div>
              <div className="canvas-inspector-row">
                <label>
                  Rotation{input("angle", selection.angle, -360, 360)}
                </label>
                <label>
                  Opacité
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={selection.opacity}
                    onChange={(e) => patch({ opacity: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="canvas-dimensions-heading">
                <strong>Dimensions</strong>
                <Button
                  icon={selection.ratioLocked !== false ? Link2 : Unlink}
                  variant="quiet"
                  aria-pressed={selection.ratioLocked !== false}
                  title={
                    selection.ratioLocked !== false
                      ? "Proportions liées : aucune déformation"
                      : "Proportions libres"
                  }
                  onClick={() =>
                    patch({ ratioLocked: selection.ratioLocked === false })
                  }
                >
                  {selection.ratioLocked !== false ? "Liées" : "Libres"}
                </Button>
              </div>
              <div className="canvas-inspector-row">
                <DimensionField
                  name="Largeur"
                  value={selection.getScaledWidth()}
                  commit={(value) => resizeSelection("width", value)}
                />
                <DimensionField
                  name="Hauteur"
                  value={selection.getScaledHeight()}
                  commit={(value) => resizeSelection("height", value)}
                />
              </div>
              <div className="canvas-inspector-row">
                <Button
                  variant="secondary"
                  onClick={() =>
                    patch({
                      left: (size.width - selection.getScaledWidth()) / 2,
                    })
                  }
                >
                  Centrer ↔
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    patch({
                      top: (size.height - selection.getScaledHeight()) / 2,
                    })
                  }
                >
                  Centrer ↕
                </Button>
              </div>
              <div className="canvas-inspector-row">
                <Button
                  icon={ChevronUp}
                  variant="secondary"
                  onClick={() => {
                    canvas.current.bringObjectForward(selection);
                    record();
                  }}
                >
                  Avancer
                </Button>
                <Button
                  icon={ChevronDown}
                  variant="secondary"
                  onClick={() => {
                    canvas.current.sendObjectBackwards(selection);
                    record();
                  }}
                >
                  Reculer
                </Button>
              </div>
              <Button icon={Copy} variant="secondary" onClick={duplicate}>
                Dupliquer
              </Button>
              {selection.animalId && canSave && (
                <Button
                  icon={Sparkles}
                  disabled={Boolean(busy)}
                  onClick={cutout}
                >
                  Détourer l’animal
                </Button>
              )}
              <Button icon={Trash2} variant="secondary" onClick={remove}>
                Supprimer l’élément
              </Button>
            </>
          ) : (
            <>
              <p>
                Choisissez un modèle ou ajoutez vos photos et textes.
                Sélectionnez un élément pour le personnaliser ici.
              </p>
              <p>
                Double-cliquez sur un texte pour écrire directement. Utilisez
                les poignées pour agrandir ou pivoter.
              </p>
              <small>
                Ctrl / ⌘ Z : annuler
                <br />
                Suppr : retirer la sélection
                <br />
                Glisser une image : importer
              </small>
            </>
          )}
        </aside>
      </div>
      <footer className="canvas-status">
        <span>{saved}</span>
        <span>
          {size.width} × {size.height} px · {objects.length} élément(s)
        </span>
        <a
          href="https://github.com/fabricjs/fabric.js"
          target="_blank"
          rel="noreferrer"
        >
          Créé avec Fabric.js · MIT
        </a>
      </footer>
      {pendingTemplate && (
        <Modal
          title="Changer de modèle ?"
          onClose={() => setPendingTemplate(null)}
        >
          <p>
            Les éléments actuels seront remplacés. Vous pourrez annuler ce
            changement dans l’atelier.
          </p>
          <div className="button-row">
            <Button
              onClick={() => {
                const next = pendingTemplate;
                setPendingTemplate(null);
                template(next);
              }}
            >
              Remplacer le visuel
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPendingTemplate(null)}
            >
              Annuler
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
