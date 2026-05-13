#!/usr/bin/env node
// Post-build: rewrite dist/manifest.json's `code` field to point at the hashed
// plugin entry (plugin-<hash>.js produced by vite). Also sync everything into
// the running Penpot frontend container so the new code is served immediately.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
const files = readdirSync(dist);
const pluginEntry = files.find((f) => /^plugin-[A-Za-z0-9_-]+\.js$/.test(f));
if (!pluginEntry) {
    console.error("postbuild: no plugin-<hash>.js found in dist/");
    process.exit(1);
}

const manifestPath = resolve(dist, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.code = pluginEntry;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n");
console.log("postbuild: manifest.code =", pluginEntry);

// Sync into container
const container = "penpot-penpot-frontend-1";
const dest = "/var/www/app/plugins/mcp";
for (const f of ["manifest.json", "index.html", "index.js", pluginEntry]) {
    execSync(`docker cp ${resolve(dist, f)} ${container}:${dest}/${f}`, { stdio: "inherit" });
}
// Sync assets dir
execSync(`docker cp ${resolve(dist, "assets")} ${container}:${dest}/`, { stdio: "inherit" });

// Patch Penpot DB so the installed plugin record points at the new entry.
// Pipe SQL via stdin to dodge shell quoting hell.
const sql = `UPDATE profile SET props = jsonb_set(props::jsonb, '{~:plugins,~:data,342a3fe3-7634-80a4-8008-030592bd85fb,~:code}', '"${pluginEntry}"'::jsonb)::text::json WHERE email='zeskywa499@gmail.com';`;
execSync("docker exec -i penpot-penpot-postgres-1 psql -U penpot -d penpot", {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
});

console.log("postbuild: DB code field updated to", pluginEntry);
