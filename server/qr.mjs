import QRCode from "qrcode";
export const refugeLink =
  "https://www.la-spa.fr/etablissement/refuge-spa-de-moree-jean-leriche/";
export function animalQrAddress(a, fallback = refugeLink) {
  try {
    const u = new URL(a.source_url);
    if (
      u.origin === "https://www.la-spa.fr" &&
      /^\/(animal|animaux)\//.test(u.pathname) &&
      !u.username &&
      !u.password
    )
      return { url: u.href, label: "Fiche SPA" };
  } catch {}
  return { url: fallback || refugeLink, label: "Page du refuge" };
}
export function qrData(url) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" }),
    n = modules.size;
  let path = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (modules.data[y * n + x]) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  return (
    "data:image/svg+xml;base64," +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`,
    ).toString("base64")
  );
}
