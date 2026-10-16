import { createElement } from "react";
import { Cat, Dog, Baby, Rabbit, Bird, PawPrint } from "lucide-react";

export function CompatibilityIcon({ subject = "", ...props }) {
  const key = subject.toLocaleLowerCase("fr");
  const Icon = /chat|cat/.test(key)
    ? Cat
    : /chien|dog/.test(key)
      ? Dog
      : /enfant|child|kid/.test(key)
        ? Baby
        : /lapin|rabbit|nac/.test(key)
          ? Rabbit
          : /oiseau|bird/.test(key)
            ? Bird
            : PawPrint;
  return createElement(Icon, {
    size: 24,
    strokeWidth: 1.8,
    "aria-hidden": true,
    ...props,
  });
}
