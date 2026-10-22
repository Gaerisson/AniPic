export const canvasTemplates = [
  ["editorial", "Éditorial SPA", "Un titre affirmé, un grand portrait."],
  ["glass", "Verre boréal", "Lumière douce, panneau translucide."],
  ["duo", "Deux belles histoires", "Deux portraits autour de votre message."],
  [
    "magazine",
    "Le magazine du refuge",
    "Typographie éditoriale et détails fins.",
  ],
  [
    "spotlight",
    "Un regard, une rencontre",
    "Contraste profond et accent lumineux.",
  ],
  [
    "event",
    "Les portes du refuge",
    "Un événement à annoncer, une date à retenir.",
  ],
  ["minimal", "L’essentiel", "Du blanc, de l’espace et une belle photo."],
  [
    "nature",
    "Instants de nature",
    "Des formes organiques et des tons apaisants.",
  ],
  ["season", "Lumière de saison", "Un dégradé lumineux pour chaque saison."],
];

export function canvasTemplateDocument(
  type,
  {
    width: w = 1920,
    height: h = 720,
    colors = ["#ece0ca", "#f47721", "#514838"],
    refuge = "Refuge de Morée",
  } = {},
) {
  const objects = [],
    [base, accent, ink] = colors;
  const rect = (name, x, y, width, height, fill, extra = {}) =>
    objects.push({
      type: "Rect",
      name,
      left: x * w,
      top: y * h,
      width: width * w,
      height: height * h,
      fill,
      ...extra,
    });
  const circle = (x, y, r, fill) =>
    objects.push({
      type: "Circle",
      name: "Lumière",
      left: x * w,
      top: y * h,
      radius: r * h,
      fill,
    });
  const text = (value, x, y, width, size, color = ink, extra = {}) =>
    objects.push({
      type: "Textbox",
      name: value.split("\n")[0],
      text: value,
      left: x * w,
      top: y * h,
      width: width * w,
      fontSize: w * size,
      fontFamily: "Arial",
      fill: color,
      lineHeight: 1.08,
      ...extra,
    });
  let slot = 0;
  const frame = (x, y, width, height) => {
    slot++;
    rect("Emplacement photo " + slot, x, y, width, height, "#ffffff20", {
      rx: h * 0.025,
      ry: h * 0.025,
      stroke: accent,
      strokeWidth: 2,
      strokeDashArray: [8, 6],
    });
    text(
      "Votre portrait",
      x + 0.015,
      y + height * 0.45,
      width - 0.03,
      0.013,
      ink,
      { name: "Repère photo " + slot, textAlign: "center", opacity: 0.45 },
    );
  };
  let background = base;
  if (type === "glass" || type === "season") {
    background = {
      type: "linear",
      coords: { x1: 0, y1: 0, x2: w, y2: h },
      colorStops: [
        { offset: 0, color: base },
        { offset: 1, color: type === "glass" ? "#506d89" : accent },
      ],
    };
    circle(0.71, -0.4, 0.85, "#ffffff12");
    if (type === "glass")
      rect("Panneau de verre", 0.045, 0.12, 0.91, 0.76, "#ffffff24", {
        rx: h * 0.06,
        ry: h * 0.06,
        stroke: "#ffffff80",
        strokeWidth: 1.5,
        shadow: { type: "shadow", color: "#00000024", blur: 35, offsetY: 14 },
      });
    else
      for (let i = 0; i < 14; i++)
        circle(
          (i * 0.137) % 1,
          (i * 0.27) % 1,
          0.004 + (i % 3) * 0.003,
          "#ffffff45",
        );
    text(refuge, 0.08, 0.19, 0.57, 0.023);
    text(
      "Leur prochaine\nbelle histoire,\nc’est vous.",
      0.08,
      0.34,
      0.55,
      0.04,
      ink,
      { fontWeight: "bold" },
    );
    text("Une rencontre peut tout changer.", 0.08, 0.79, 0.6, 0.016);
  } else if (type === "duo") {
    background = "#fffaf2";
    circle(-0.13, 0.15, 0.8, base);
    circle(0.8, 0.38, 0.65, accent + "28");
    frame(0.045, 0.23, 0.24, 0.65);
    frame(0.715, 0.23, 0.24, 0.65);
    text(refuge, 0.3, 0.24, 0.4, 0.018, ink, {
      textAlign: "center",
      charSpacing: 80,
    });
    text(
      "Deux regards.\nMille raisons\nd’aimer.",
      0.31,
      0.41,
      0.38,
      0.033,
      ink,
      { textAlign: "center", fontWeight: "bold" },
    );
    text("Venez les rencontrer au refuge", 0.3, 0.79, 0.4, 0.013, ink, {
      textAlign: "center",
    });
  } else if (type === "magazine") {
    background = "#faf7f0";
    rect("Portrait · fond", 0.64, 0, 0.36, 1, base);
    rect("Filet éditorial", 0.06, 0.21, 0.51, 0.003, accent);
    text(refuge.toUpperCase(), 0.06, 0.12, 0.49, 0.014, ink, {
      charSpacing: 140,
    });
    text("Une place\ndans votre\nhistoire.", 0.06, 0.3, 0.55, 0.048, ink, {
      fontFamily: "Georgia",
    });
    text("DES COMPAGNONS À RENCONTRER", 0.06, 0.84, 0.55, 0.012, accent, {
      charSpacing: 80,
    });
  } else if (type === "spotlight") {
    background = "#13252d";
    circle(0.6, -0.35, 1.1, accent + "24");
    rect("Accent", 0.07, 0.2, 0.045, 0.009, accent);
    text(refuge, 0.07, 0.1, 0.6, 0.018, "#f8f4ea");
    text("Il manque\nencore vous.", 0.07, 0.31, 0.57, 0.055, "#f8f4ea", {
      fontWeight: "bold",
    });
    rect("Invitation", 0.07, 0.79, 0.4, 0.105, accent, {
      rx: h * 0.04,
      ry: h * 0.04,
    });
    text("FAITES LE PREMIER PAS", 0.09, 0.822, 0.36, 0.014, "#1a211e", {
      fontWeight: "bold",
      textAlign: "center",
    });
  } else if (type === "event") {
    background = accent;
    rect("Carton événement", 0.045, 0.1, 0.91, 0.8, "#fffaf0", {
      rx: h * 0.045,
      ry: h * 0.045,
      shadow: { type: "shadow", color: "#00000020", blur: 25, offsetY: 10 },
    });
    text(refuge, 0.08, 0.18, 0.61, 0.019, "#39342d");
    text("Nos portes\nsont ouvertes.", 0.08, 0.32, 0.56, 0.046, "#39342d", {
      fontWeight: "bold",
    });
    rect("Date de l’événement", 0.08, 0.74, 0.51, 0.1, accent, {
      rx: 12,
      ry: 12,
    });
    text("SAMEDI · 14 H — 18 H", 0.1, 0.775, 0.47, 0.015, "#29251f", {
      fontWeight: "bold",
    });
  } else if (type === "minimal") {
    background = "#fcfbf8";
    rect("Bande de couleur", 0.67, 0, 0.33, 1, base);
    text(refuge, 0.075, 0.17, 0.52, 0.018, ink);
    text(
      "Les belles\nrencontres\ncommencent ici.",
      0.075,
      0.34,
      0.57,
      0.039,
      ink,
      { fontWeight: "bold" },
    );
    rect("Signature", 0.075, 0.82, 0.07, 0.007, accent);
    text("ADOPTER · PARTAGER · S’ENGAGER", 0.075, 0.88, 0.55, 0.011, ink, {
      charSpacing: 50,
    });
  } else if (type === "nature") {
    background = "#eaf0e5";
    circle(-0.13, 0.62, 0.65, "#b2c5a4");
    circle(0.69, -0.65, 1.2, "#d0dfc4");
    circle(0.78, 0.46, 0.65, "#78926c30");
    text(refuge, 0.075, 0.2, 0.57, 0.019, "#2c4838");
    text(
      "Un peu de nature.\nBeaucoup\nd’amour.",
      0.075,
      0.36,
      0.56,
      0.041,
      "#2c4838",
      { fontFamily: "Georgia" },
    );
    text(
      "De nouvelles histoires à écrire ensemble.",
      0.075,
      0.83,
      0.6,
      0.015,
      "#2c4838",
    );
  } else {
    rect("Fond de droite", 0.66, 0, 0.34, 1, accent);
    text(refuge, 0.075, 0.17, 0.55, 0.024);
    text(
      "Leur prochaine\nbelle histoire,\nc’est vous.",
      0.075,
      0.34,
      0.55,
      0.039,
      ink,
      { fontWeight: "bold" },
    );
    text("À rencontrer au refuge", 0.075, 0.81, 0.55, 0.016);
  }
  objects.push({
    type: "Image",
    name: "Logo SPA",
    src: "/spa-logo.png",
    left: w * 0.88,
    top: h * 0.06,
    scaleX: (w * 0.065) / 542,
    scaleY: (w * 0.065) / 542,
  });
  return {
    schema: 1,
    template: type,
    width: w,
    height: h,
    scene: {
      version: "7.4.0",
      background,
      objects: objects.map((object) => ({
        originX: "left",
        originY: "top",
        ratioLocked: true,
        ...object,
      })),
    },
  };
}
