#!/usr/bin/env node
// Rewrites the "Recent activity" block in both READMEs with the latest pushed public repos.
import { readFile, writeFile } from "node:fs/promises";

const USER = "Luprintech";
const SKIP = new Set(["luprintech"]); // this profile repo
const MAX = 5;
const FILES = [
  { path: "README.md", lang: "es" },
  { path: "README_EN.md", lang: "en" },
];
const START = "<!-- ACTIVITY:START -->";
const END = "<!-- ACTIVITY:END -->";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-activity",
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
};

const res = await fetch(
  `https://api.github.com/users/${USER}/repos?type=owner&sort=pushed&per_page=30`,
  { headers },
);
if (!res.ok) throw new Error(`GitHub API ${res.status}`);
const repos = (await res.json())
  .filter((r) => !r.fork && !r.archived && !r.private && r.description && !SKIP.has(r.name.toLowerCase()))
  .slice(0, MAX);

const clean = (t) => (t ?? "").replace(/[\r\n|<>\[\]`]+/g, " ").replace(/\s+/g, " ").trim();
const rel = (iso, lang) => {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 864e5));
  if (lang === "es") {
    return d === 0 ? "hoy" : d === 1 ? "ayer" : d < 30 ? `hace ${d} días` : `hace ${Math.floor(d / 30)} meses`;
  }
  return d === 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : `${Math.floor(d / 30)} months ago`;
};

for (const { path, lang } of FILES) {
  const rows = repos
    .map((r) => {
      const desc = clean(r.description);
      return `| [**${r.name}**](${r.html_url}) | ${desc || "—"} | ${rel(r.pushed_at, lang)} |`;
    })
    .join("\n");
  const head =
    lang === "es" ? "| Repositorio | Descripción | Último push |" : "| Repository | Description | Last push |";
  const block = `${START}\n\n${head}\n|---|---|---|\n${rows}\n\n${END}`;
  const file = await readFile(path, "utf8");
  const s = file.indexOf(START);
  const e = file.indexOf(END);
  if (s === -1 || e === -1) throw new Error(`Markers not found in ${path}`);
  await writeFile(path, file.slice(0, s) + block + file.slice(e + END.length));
}
console.log(`Updated with ${repos.length} repos`);
