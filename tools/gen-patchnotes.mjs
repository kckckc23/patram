/*
 * Generates patchnotes.json from the git history — the site never hand-writes
 * release notes.
 *
 * A release is a tag matching v<semver>; the commits between one tag and the
 * next become its entries, grouped by conventional-commit type. Commits after
 * the newest tag land under "Unreleased". Run it after tagging:
 *
 *   git tag v0.4.0
 *   node tools/gen-patchnotes.mjs
 *   git add patchnotes.json && git commit
 *
 * The output carries no generation timestamp, so re-running on an unchanged
 * history produces a byte-identical file (no diff churn, reviewable releases).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../patchnotes.json", import.meta.url));
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 << 20 }).trim();

/* type → the heading it appears under. Types absent from this map are dropped;
   the run reports how many, so nothing disappears silently. */
const GROUPS = {
  feat: "Added",
  fix: "Fixed",
  perf: "Changed",
  refactor: "Changed",
  style: "Changed",
  build: "Changed",
  chore: "Maintenance",
  docs: "Maintenance",
};
const SKIP_TYPES = new Set(["test", "ci"]);          // internal-only, not user-facing

/* This product was rebuilt from scratch in July 2026 (React/Vite/full-stack →
   static + Pyodide). The commits before that describe software that no longer
   exists — "initialize React project with Vite and Tailwind" is not a patch note
   for what ships today — so release history starts at the migration. Matched by
   subject rather than by hash so it survives a history rewrite. Pass --all to
   include everything. */
const HISTORY_STARTS_AFTER = "node to py migration";
const ORDER = ["Breaking", "Added", "Fixed", "Changed", "Maintenance"];
const CONVENTIONAL = /^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

const US = "\x1f", RS = "\x1e";
const includeAll = process.argv.includes("--all");

function commits(range) {
  const out = git("log", "--no-merges", `--format=%H${US}%s${US}%b${US}%cs${RS}`, ...(range ? [range] : []));
  return out.split(RS).map((r) => r.trim()).filter(Boolean).map((r) => {
    const [hash, subject, body, date] = r.split(US);
    return { hash, subject, body: body || "", date };
  });
}

/* Tags newest-first, with the date the release was actually cut. */
const tags = git("for-each-ref", "--sort=-creatordate",
  "--format=%(refname:short)" + US + "%(creatordate:short)", "refs/tags/v*")
  .split("\n").filter(Boolean).map((l) => {
    const [name, date] = l.split(US);
    return { name, date };
  });

const spans = [];
if (tags.length) {
  const ahead = commits(`${tags[0].name}..HEAD`);
  if (ahead.length) spans.push({ version: "Unreleased", date: git("log", "-1", "--format=%cs"), commits: ahead });
  tags.forEach((t, i) => {
    const prev = tags[i + 1];
    spans.push({ version: t.name, date: t.date, commits: commits(prev ? `${prev.name}..${t.name}` : t.name) });
  });
} else {
  // no tags yet: everything is unreleased, which is the honest description
  spans.push({ version: "Unreleased", date: git("log", "-1", "--format=%cs"), commits: commits(null) });
}

/* commits that predate the rewrite, excluded unless --all */
let inScope = null, preHistory = 0;
if (!includeAll && HISTORY_STARTS_AFTER) {
  const boundary = git("log", "--format=%H", "--fixed-strings", `--grep=${HISTORY_STARTS_AFTER}`)
    .split("\n").filter(Boolean).pop();
  if (boundary) {
    inScope = new Set(git("log", "--format=%H", `${boundary}..HEAD`).split("\n").filter(Boolean));
    inScope.add(boundary);
  }
}

const skipped = [];
const seen = new Set();
const releases = [];

for (const span of spans) {
  const buckets = new Map();
  for (const c of span.commits) {
    if (inScope && !inScope.has(c.hash)) { preHistory++; continue; }
    const m = c.subject.match(CONVENTIONAL);
    if (!m) { skipped.push(`${c.hash.slice(0, 7)} ${c.subject}`); continue; }
    const [, type, scope, bang, textRaw] = m;
    if (SKIP_TYPES.has(type)) { skipped.push(`${c.hash.slice(0, 7)} ${c.subject} [${type}]`); continue; }
    const breaking = !!bang || /^BREAKING[ -]CHANGE:/m.test(c.body);
    const group = breaking ? "Breaking" : GROUPS[type];
    if (!group) { skipped.push(`${c.hash.slice(0, 7)} ${c.subject} [unmapped: ${type}]`); continue; }

    // the squash-merge history repeats subjects; list each change once
    const text = textRaw.replace(/\s+/g, " ").trim();
    const key = `${type}|${scope || ""}|${text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group).push({ ...(scope ? { scope } : {}), text: text[0].toUpperCase() + text.slice(1) });
  }
  const groups = ORDER.filter((g) => buckets.has(g)).map((g) => ({ title: g, entries: buckets.get(g) }));
  if (groups.length) releases.push({ version: span.version, date: span.date, groups });
}

const json = JSON.stringify({ releases }, null, 1) + "\n";
let before = "";
try { before = readFileSync(OUT, "utf8"); } catch {}
writeFileSync(OUT, json);

const n = releases.reduce((s, r) => s + r.groups.reduce((t, g) => t + g.entries.length, 0), 0);
console.log(`patchnotes.json ${before === json ? "unchanged" : "written"} — ${releases.length} release(s), ${n} entries`);
releases.forEach((r) => console.log(`  ${r.version.padEnd(12)} ${r.date}  ${r.groups.map((g) => `${g.title} ${g.entries.length}`).join(" · ")}`));
if (preHistory) console.log(`\n  ${preHistory} commit(s) predate "${HISTORY_STARTS_AFTER}" and are excluded (use --all to include them).`);
if (skipped.length) {
  console.log(`\n  ${skipped.length} commit(s) not listed (non-conventional subject, or an internal type):`);
  skipped.forEach((s) => console.log(`    - ${s}`));
}
