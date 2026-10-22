let csrf = "";
export function uploadWithProgress(url, body, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api" + url);
    xhr.withCredentials = true;
    xhr.timeout = 600000;
    xhr.setRequestHeader("X-CSRF-Token", csrf);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Connexion interrompue pendant l’import. Vérifiez les fichiers déjà reçus avant de réessayer.",
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error("Import trop long. Vérifiez les fichiers déjà reçus."));
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error("Réponse d’import invalide."));
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Import impossible."));
    };
    xhr.send(body);
  });
}
export function setCsrf(value) {
  csrf = value || "";
}
export async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(value));
      return;
    }
  } catch {
    /* LAN HTTP or clipboard permission: try the user-triggered fallback. */
  }
  const previous = document.activeElement,
    field = document.createElement("textarea");
  field.value = String(value);
  field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.append(field);
  try {
    field.focus();
    field.select();
    if (!document.execCommand?.("copy")) throw new Error("Copie indisponible.");
  } finally {
    field.remove();
    previous?.focus();
  }
}
let pendingRequests = 0;
let lastNetwork = { online: true, at: null, latency: null };
export const networkSnapshot = () => ({ ...lastNetwork });
function feedback(name, detail) {
  if (name === "anipic-network") lastNetwork = { ...lastNetwork, ...detail };
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(name, { detail }));
}
export async function api(url, options = {}) {
  const headers = { "X-CSRF-Token": csrf, ...options.headers };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const started = Date.now();
  pendingRequests++;
  feedback("anipic-requests", { pending: pendingRequests });
  try {
    let response;
    try {
      response = await fetch("/api" + url, {
        credentials: "same-origin",
        ...options,
        headers,
      });
    } catch (error) {
      if (error.name !== "AbortError")
        feedback("anipic-network", { online: false });
      throw error;
    }
    feedback("anipic-network", {
      online: true,
      at: Date.now(),
      latency: Date.now() - started,
    });
    const data = await response
      .json()
      .catch(() => ({ error: "Réponse serveur invalide." }));
    if (!response.ok)
      throw Object.assign(new Error(data.error || "Opération impossible."), {
        code: data.code,
        status: response.status,
      });
    return data;
  } finally {
    pendingRequests--;
    feedback("anipic-requests", { pending: pendingRequests });
  }
}
export async function apiBlob(url, body) {
  const started = Date.now();
  pendingRequests++;
  feedback("anipic-requests", { pending: pendingRequests });
  try {
    let response;
    try {
      response = await fetch("/api" + url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrf, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      feedback("anipic-network", { online: false });
      throw error;
    }
    feedback("anipic-network", {
      online: true,
      at: Date.now(),
      latency: Date.now() - started,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Téléchargement impossible.");
    }
    return await response.blob();
  } finally {
    pendingRequests--;
    feedback("anipic-requests", { pending: pendingRequests });
  }
}
export async function apiDownload(url, body, filename) {
  const objectUrl = URL.createObjectURL(await apiBlob(url, body)),
    link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
export const bytes = (value) => {
  if (!value) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return (
    (value / 1024 ** i).toLocaleString("fr-FR", {
      maximumFractionDigits: i > 1 ? 1 : 0,
    }) +
    " " +
    units[i]
  );
};
export const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
export const speciesName = { dog: "Chien", cat: "Chat", other: "NAC" };
export const compatibilityName = (key) =>
  ({
    chien: "Chiens",
    chiens: "Chiens",
    dog: "Chiens",
    dogs: "Chiens",
    chat: "Chats",
    chats: "Chats",
    cat: "Chats",
    cats: "Chats",
    enfant: "Enfants",
    enfants: "Enfants",
    children: "Enfants",
  })[key.toLowerCase()] || key;
export function animalAge(value) {
  const born = new Date(value),
    current = new Date();
  if (!value || !Number.isFinite(+born) || born > current) return "À préciser";
  let months =
    (current.getFullYear() - born.getFullYear()) * 12 +
    current.getMonth() -
    born.getMonth();
  if (current.getDate() < born.getDate()) months--;
  if (months < 1) return "Moins d’un mois";
  if (months < 12) return months + " mois";
  const years = Math.floor(months / 12);
  return years + " an" + (years > 1 ? "s" : "");
}
export const statusName = {
  available: "À l’adoption",
  reserved: "Réservé",
  adopted: "Adopté",
  source_missing: "Absent de la source",
};
export const imageUrl = (photoId, width = 640) =>
  photoId ? `/media/${photoId}?w=${width}` : null;
export const uid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (
          Number(c) ^
          (crypto.getRandomValues(new Uint8Array(1))[0] &
            (15 >> (Number(c) / 4)))
        ).toString(16),
      );
