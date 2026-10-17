// Disjoint areas: the portrait and animated strips never share a rectangle.
export function annualLayout(w, h) {
  if (h > w)
    return {
      main: { left: w * 0.09, top: h * 0.14, width: w * 0.82, height: h * 0.6 },
      rails: [
        {
          x: 0,
          y: h * 0.8,
          width: w,
          height: h * 0.145,
          cardWidth: w * 0.2,
          cardHeight: h * 0.13,
          gap: w * 0.025,
        },
      ],
    };
  const railWidth = Math.min(w * 0.19, h * 0.29),
    gap = w * 0.015;
  return {
    main: { left: w * 0.285, top: h * 0.13, width: w * 0.43, height: h * 0.74 },
    rails: [w * 0.035, w * 0.965 - railWidth].map((x) => ({
      x,
      y: 0,
      width: railWidth,
      height: h,
      cardWidth: railWidth - gap,
      cardHeight: (railWidth - gap) * 1.2,
      gap,
    })),
  };
}
