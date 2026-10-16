import { isIP, BlockList } from "node:net";
export function normalizedIP(value) {
  const ip = String(value || "")
    .replace(/^::ffff:/i, "")
    .split("%")[0];
  return isIP(ip) ? ip : null;
}
export function validateNetwork(value) {
  const parts = String(value).trim().split("/");
  const ip = normalizedIP(parts[0]);
  const family = isIP(ip || "");
  if (!family || parts.length > 2)
    throw Object.assign(new Error("Adresse IP ou réseau CIDR invalide."), {
      statusCode: 400,
    });
  const prefix =
    parts[1] === undefined ? (family === 4 ? 32 : 128) : Number(parts[1]);
  if (
    !/^\d+$/.test(String(prefix)) ||
    prefix < 1 ||
    prefix > (family === 4 ? 32 : 128)
  )
    throw Object.assign(
      new Error(
        "Préfixe de réseau invalide. Les réseaux /0 ne sont pas autorisés.",
      ),
      { statusCode: 400 },
    );
  return `${ip}/${prefix}`;
}
export function matchesNetwork(ipValue, network) {
  const ip = normalizedIP(ipValue);
  if (!ip) return false;
  try {
    const [base, prefix] = validateNetwork(network).split("/");
    const family = isIP(base) === 4 ? "ipv4" : "ipv6";
    const list = new BlockList();
    list.addSubnet(base, Number(prefix), family);
    return list.check(ip, family);
  } catch {
    return false;
  }
}
export function accountAllowsIP(db, userId, ip) {
  const rules = db
    .prepare("SELECT network FROM ip_rules WHERE user_id=?")
    .all(userId);
  return (
    !rules.length || rules.some((rule) => matchesNetwork(ip, rule.network))
  );
}
