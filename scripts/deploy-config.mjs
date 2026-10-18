import assert from "node:assert/strict";

// Compose v2 omits false booleans from JSON; newer versions retain them.
// Check the explicit YAML setting as well as the normalized mount.
export function assertSafeBindSource(text, target) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /^( *)- type: bind\s*$/.exec(lines[i]);
    if (!match) continue;
    const indent = match[1].length;
    const block = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() && lines[j].search(/\S/) <= indent) break;
      block.push(lines[j]);
    }
    if (!block.some((line) => line.trim() === `target: ${target}`)) continue;
    const bind = block.findIndex(
      (line) => line === " ".repeat(indent + 2) + "bind:",
    );
    assert.ok(
      bind >= 0 &&
        block[bind + 1] === " ".repeat(indent + 4) + "create_host_path: false",
      `${target} : create_host_path: false doit être explicite dans la source Compose.`,
    );
    return;
  }
  assert.fail(`Montage bind explicite introuvable : ${target}.`);
}

export function assertNormalizedBind(mount, target, source) {
  assert.equal(mount?.type, "bind", `${target} : bind requis.`);
  assert.equal(mount.source, source, `${target} : chemin NAS modifié.`);
  assert.ok(
    mount.bind?.create_host_path === undefined ||
      mount.bind.create_host_path === false,
    `${target} : création implicite de dossiers interdite.`,
  );
}
