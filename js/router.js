export function getRoute() {
  const h = (location.hash || "").trim();
  // support #/tool, #tool, and empty/root
  let path = h.replace(/^#/, "");
  if (path.startsWith("/")) path = path.slice(1);
  path = path.replace(/\/+$/, "");
  if (!path) return { view: "home" };
  if (path === "patchnotes") return { view: "patchnotes" };
  return { view: "tool", id: path };
}

export function toolHash(id) { return `#/${id}`; }
export function homeHash() { return "#/"; }
export function patchnotesHash() { return "#/patchnotes"; }

export function navigateToTool(id) {
  const next = toolHash(id);
  if (location.hash !== next) location.hash = next;
}
export function navigateHome() {
  // keep hash routing, don't use history API
  if (location.hash !== "#/" && location.hash !== "") location.hash = "#/";
  else {
    // ensure route handler runs for initial empty state normalization if needed
    location.hash = "#/";
  }
}
export function navigatePatchnotes() {
  const next = patchnotesHash();
  if (location.hash !== next) location.hash = next;
}
