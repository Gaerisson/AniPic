const tokens = (s) =>
  String(s || "").match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
export function textDiff(before, after) {
  const a = tokens(before),
    b = tokens(after),
    out = [];
  const push = (kind, text) => {
    if (!text) return;
    if (out.at(-1)?.kind === kind) out.at(-1).text += text;
    else out.push({ kind, text });
  };
  if (a.length * b.length > 2500000) {
    let i = 0,
      j = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    while (
      j < a.length - i &&
      j < b.length - i &&
      a[a.length - 1 - j] === b[b.length - 1 - j]
    )
      j++;
    push("same", a.slice(0, i).join(""));
    push("remove", a.slice(i, a.length - j).join(""));
    push("add", b.slice(i, b.length - j).join(""));
    push("same", j ? a.slice(-j).join("") : "");
    return out;
  }
  const width = b.length + 1,
    grid = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      grid[i * width + j] =
        a[i] === b[j]
          ? grid[(i + 1) * width + j + 1] + 1
          : Math.max(grid[(i + 1) * width + j], grid[i * width + j + 1]);
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push("same", a[i++]);
      j++;
    } else if (
      j < b.length &&
      (i === a.length || grid[i * width + j + 1] > grid[(i + 1) * width + j])
    )
      push("add", b[j++]);
    else push("remove", a[i++]);
  }
  return out;
}
