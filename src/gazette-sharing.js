export function gazetteFileDescriptor(job, format, page = 0) {
  const base = `/api/creative/gazette/${job.id}`,
    month = job.result.month;
  if (format === "pdf")
    return {
      url: base + "/file",
      name: `gazette-${month}.pdf`,
      type: "application/pdf",
    };
  if (format === "page")
    return {
      url: base + `/image/${page}`,
      name: `gazette-${month}-page-${page + 1}.jpg`,
      type: "image/jpeg",
    };
  return {
    url: base + "/social",
    name: `gazette-${month}-reseaux.png`,
    type: "image/png",
  };
}
export async function prepareGazetteFile(
  descriptor,
  { fetcher = fetch, FileClass = File } = {},
) {
  const response = await fetcher(descriptor.url, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Error(data.error || "Le fichier de partage n’a pas pu être préparé.");
  }
  const blob = await response.blob();
  if (!blob.size || blob.type.split(";")[0] !== descriptor.type)
    throw Error(
      "Le serveur n’a pas renvoyé le fichier attendu. Relancez la préparation.",
    );
  return new FileClass([blob], descriptor.name, { type: descriptor.type });
}
export function canShareGazette(file, nav = globalThis.navigator) {
  try {
    return (
      !!file &&
      typeof nav?.share === "function" &&
      typeof nav?.canShare === "function" &&
      nav.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}
// Call synchronously from a click, after prepareGazetteFile completed, to retain user activation.
export function shareGazette(file, caption, nav = globalThis.navigator) {
  if (!canShareGazette(file, nav))
    throw Error(
      "Le partage de fichiers n’est pas disponible dans ce navigateur. Téléchargez le fichier pour le joindre dans WhatsApp.",
    );
  return nav.share({ files: [file], title: file.name, text: caption });
}
