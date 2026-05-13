#!/usr/bin/env node
// tex2svg — render a LaTeX expression to a self-contained SVG (every glyph
// is a path, no external font dependency). Suitable for Penpot drag&drop.
//
// Usage:
//   node tex2svg.mjs "\\lim_{x \\to a} f(x) = L"
//   node tex2svg.mjs "f(x) = x^2 + 2x + 1" --inline
//   node tex2svg.mjs "..." --out /tmp/eq.svg --size 22 --color "#1f2229"
//
// Defaults: display mode, size 22px, color #1f2229, out /tmp/eq.svg

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { writeFileSync } from "node:fs";

function parseArgs(argv) {
    const a = { tex: null, display: true, size: 22, color: "#1f2229", out: "/tmp/eq.svg" };
    const rest = [];
    for (let i = 2; i < argv.length; i++) {
        const v = argv[i];
        if (v === "--inline") a.display = false;
        else if (v === "--display") a.display = true;
        else if (v === "--size") a.size = parseFloat(argv[++i]);
        else if (v === "--color") a.color = argv[++i];
        else if (v === "--out") a.out = argv[++i];
        else rest.push(v);
    }
    a.tex = rest.join(" ");
    return a;
}

const args = parseArgs(process.argv);
if (!args.tex) {
    console.error("usage: tex2svg.mjs <LaTeX> [--inline] [--size N] [--color #hex] [--out path]");
    process.exit(1);
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const tex = new TeX({ packages: AllPackages });
// fontCache: 'none' inlines every glyph as <path> — no external <defs> or font fetch.
const svg = new SVG({ fontCache: "none" });
const html = mathjax.document("", { InputJax: tex, OutputJax: svg });

const node = html.convert(args.tex, { display: args.display, em: args.size, ex: args.size / 2 });
let out = adaptor.innerHTML(node);
// adaptor wraps in <mjx-container>; strip it, keep the <svg>
const svgMatch = out.match(/<svg[\s\S]*<\/svg>/);
if (!svgMatch) {
    console.error("no <svg> in mathjax output");
    process.exit(2);
}
let s = svgMatch[0];
// Force ink color
s = s.replace(/<svg /, `<svg color="${args.color}" `);

writeFileSync(args.out, s);
console.error(`wrote ${args.out} (${s.length} bytes)`);
console.log(args.out);
