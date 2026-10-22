import { visualTheme } from "../shared/visual-themes.mjs";
import { drawParticles } from "../shared/canvas-particles.mjs";
export const bannerTemplates = {
  panorama: "Refuge panoramique",
  glass: "Duo · verre lumineux",
  editorial: "Éditorial contemporain",
  paper: "Affiche papier",
  season: "Saison & célébration",
};
export const bannerPositions = {
  left: { x: 17, y: 94, scale: 1 },
  right: { x: 84, y: 94, scale: 1 },
  title: { x: 50, y: 44, scale: 1 },
  logo: { x: 10, y: 12, scale: 1 },
};
export function bannerBounds(kind, image, position, w, h) {
  const height = h * 0.77 * position.scale,
    width = image ? (height * image.width) / image.height : h * 0.45;
  return {
    x: (w * position.x) / 100 - width / 2,
    y: (h * position.y) / 100 - height,
    width,
    height,
  };
}
function cover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  ctx.drawImage(
    img,
    (w - img.width * scale) / 2,
    (h - img.height * scale) / 2,
    img.width * scale,
    img.height * scale,
  );
}
export function drawBanner(canvas, scene, assets) {
  const [w, h] = scene.size.split("x").map(Number);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d"),
    palette = visualTheme(scene.season),
    light = scene.template === "paper";
  const start = light
      ? "#fff4e3"
      : scene.template === "editorial"
        ? "#232827"
        : palette.start,
    end = light ? "#e7d2b6" : palette.end;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  if (assets.background) {
    ctx.save();
    ctx.globalAlpha = scene.template === "panorama" ? 0.76 : 0.4;
    cover(ctx, assets.background, w, h);
    ctx.restore();
    ctx.fillStyle = "#11192055";
    ctx.fillRect(0, 0, w, h);
  }
  const accent = scene.accent || palette.accent;
  ctx.fillStyle = accent;
  if (scene.template === "panorama") {
    ctx.beginPath();
    ctx.moveTo(w * 0.74, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.9, h);
    ctx.fill();
    ctx.fillStyle = "#544b3dd9";
    ctx.fillRect(0, 0, w, h * 0.19);
  }
  if (scene.template === "glass") {
    ctx.fillStyle = "#ffffff17";
    ctx.strokeStyle = "#ffffff40";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(w * 0.2, h * 0.17, w * 0.6, h * 0.63, 28);
    ctx.fill();
    ctx.stroke();
  }
  if (scene.template === "editorial") {
    ctx.fillRect(w * 0.38, h * 0.25, w * 0.04, h * 0.38);
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(w * 0.88, h * 0.4, h * 0.53, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (light) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(3, h * 0.01);
    ctx.strokeRect(w * 0.025, h * 0.04, w * 0.95, h * 0.92);
  }
  drawParticles(ctx, w, h, {
    style: scene.particles,
    theme: scene.season,
    density: scene.density,
    seed: 17,
  });
  const bounds = {};
  for (const key of ["left", "right"])
    if (assets[key]) {
      const p = scene.positions[key],
        b = bannerBounds(key, assets[key], p, w, h);
      bounds[key] = b;
      ctx.save();
      ctx.shadowColor = "#00000055";
      ctx.shadowBlur = h * 0.025;
      ctx.drawImage(assets[key], b.x, b.y, b.width, b.height);
      ctx.restore();
    }
  const logo = scene.positions.logo;
  if (assets.logo) {
    const lh = h * 0.13 * logo.scale,
      lw = (lh * assets.logo.width) / assets.logo.height;
    ctx.drawImage(
      assets.logo,
      (w * logo.x) / 100 - lw / 2,
      (h * logo.y) / 100 - lh / 2,
      lw,
      lh,
    );
    bounds.logo = {
      x: (w * logo.x) / 100 - lw / 2,
      y: (h * logo.y) / 100 - lh / 2,
      width: lw,
      height: lh,
    };
  }
  const p = scene.positions.title,
    titleColor = light ? "#392b20" : "#fffaf1";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = titleColor;
  ctx.shadowColor = "#0008";
  ctx.shadowBlur = light ? 0 : 12;
  let font = h * 0.09 * p.scale;
  ctx.font = `700 ${font}px Arial`;
  while (ctx.measureText(scene.title).width > w * 0.62 && font > h * 0.025) {
    font -= 1;
    ctx.font = `700 ${font}px Arial`;
  }
  ctx.fillText(scene.title, (w * p.x) / 100, (h * p.y) / 100);
  bounds.title = {
    x: (w * p.x) / 100 - ctx.measureText(scene.title).width / 2,
    y: (h * p.y) / 100 - font / 2,
    width: ctx.measureText(scene.title).width,
    height: font,
  };
  ctx.font = `${h * 0.034 * p.scale}px Arial`;
  ctx.fillStyle = light ? "#6f5136" : "#fff4e0";
  ctx.fillText(
    scene.subtitle.slice(0, 100),
    (w * p.x) / 100,
    (h * p.y) / 100 + font * 0.95,
    w * 0.59,
  );
  ctx.shadowBlur = 0;
  if (scene.contacts) {
    ctx.fillStyle = light
      ? "#35291f"
      : scene.template === "panorama"
        ? "#d9cbb8"
        : "#0b1119c9";
    ctx.fillRect(0, h * 0.88, w, h * 0.12);
    ctx.fillStyle = light
      ? "#fff4e3"
      : scene.template === "panorama"
        ? "#453c30"
        : "#fff6e8";
    ctx.font = `600 ${h * 0.026}px Arial`;
    ctx.fillText(scene.contacts.slice(0, 160), w / 2, h * 0.939, w * 0.9);
  }
  if (scene.showNames) {
    ctx.font = `700 ${h * 0.03}px Arial`;
    for (const k of ["left", "right"])
      if (assets[k] && scene[k + "Name"]) {
        const b = bounds[k];
        ctx.fillStyle = "#111a25d9";
        const text = scene[k + "Name"],
          tw = ctx.measureText(text).width;
        ctx.beginPath();
        ctx.roundRect(
          b.x + b.width / 2 - tw / 2 - h * 0.025,
          h * 0.81,
          tw + h * 0.05,
          h * 0.052,
          10,
        );
        ctx.fill();
        ctx.fillStyle = "#fff8ee";
        ctx.fillText(text, b.x + b.width / 2, h * 0.837);
      }
  }
  return bounds;
}
