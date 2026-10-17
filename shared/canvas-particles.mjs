export function drawParticles(
  ctx,
  w,
  h,
  { style = "auto", theme = "classic", density = 35, accent = "#ffc18c" } = {},
) {
  const kind =
    style === "auto"
      ? theme === "christmas"
        ? "snow"
        : theme === "halloween"
          ? "stars"
          : theme === "easter"
            ? "confetti"
            : "dust"
      : style;
  if (kind === "none") return;
  for (let i = 0; i < Math.round(density * 0.8); i++) {
    const x = (((i * 37.79) % 100) / 100) * w,
      y = (((i * 19.37) % 100) / 100) * h,
      r = ((2 + (i % 5) * 2) * Math.min(w, h)) / 600;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(i * 0.6);
    ctx.globalAlpha = kind === "bokeh" ? 0.16 : 0.26;
    ctx.fillStyle =
      kind === "snow"
        ? "#fff"
        : kind === "confetti"
          ? [accent, "#ceb2f2", "#a3e3d1"][i % 3]
          : accent;
    ctx.strokeStyle = ctx.fillStyle;
    if (kind === "snow") {
      ctx.lineWidth = Math.max(1, r / 5);
      for (let j = 0; j < 3; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();
      }
    } else if (kind === "stars") {
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const a = (j * Math.PI) / 5,
          d = j % 2 ? r * 0.4 : r;
        ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fill();
    } else if (kind === "confetti") ctx.fillRect(-r, -r / 3, r * 2, r * 0.7);
    else if (kind === "paws") {
      ctx.beginPath();
      ctx.ellipse(0, r * 0.6, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.ellipse(
          (j - 1.5) * r * 0.6,
          -r * 0.3 - Math.sin((j / 3) * Math.PI) * r * 0.4,
          r * 0.26,
          r * 0.38,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, kind === "bokeh" ? r * 3 : r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
