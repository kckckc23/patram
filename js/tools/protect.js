import { registerQpdf } from "./qpdf-tools.js";
import { registerConvert } from "./convert.js";

export function registerProtect(ENGINES) {
  // protect, unlock, repair -> qpdf engine
  registerQpdf(ENGINES);
  // metaStrip uses convert engine
  registerConvert(ENGINES);
}
