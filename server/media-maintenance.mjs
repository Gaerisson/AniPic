const states = new WeakMap();
function state(c) {
  if (!states.has(c)) states.set(c, { active: 0, maintenance: false });
  return states.get(c);
}
const locked = () =>
  Object.assign(
    new Error(
      "Optimisation des archives en cours. Réessayez après la fin du traitement.",
    ),
    { statusCode: 423 },
  );
export function mediaMaintenance(c) {
  return state(c).maintenance;
}
export function beginMediaWrite(c) {
  const s = state(c);
  if (s.maintenance) throw locked();
  s.active++;
  return () => s.active--;
}
export function beginMaintenance(c) {
  const s = state(c);
  if (s.maintenance || s.active)
    throw Object.assign(
      new Error(
        "Un import est en cours. Attendez sa fin avant de compresser les archives.",
      ),
      { statusCode: 409 },
    );
  s.maintenance = true;
  return () => {
    s.maintenance = false;
  };
}
