#!/usr/bin/env node
/**
 * tex2html — render a LaTeX expression to a self-contained HTML snippet
 * suitable for pasting into the Penpot HTML TO DESIGN plugin.
 *
 * Usage:
 *   node tex2html.js "\\lim_{x \\to a} f(x) = L"
 *   node tex2html.js "\\lim_{x \\to a} f(x) = L" --inline    # inline mode
 *   node tex2html.js "\\lim_{x \\to a} f(x) = L" --size 22 --color "#1f2229"
 *
 * Stdout is the HTML — pipe to clipboard or paste manually.
 *
 * Notes on the HTML shape:
 *   - KaTeX CSS is inlined (no external stylesheet needed).
 *   - KaTeX font @font-face URLs still reference external woff2 files. HTML
 *     TO DESIGN will not download those, so the math glyphs will fall back to
 *     the browser's default math/serif font. The shape/layout still tracks
 *     KaTeX (sub/superscripts, lim operator, etc.) — just without KaTeX's
 *     custom glyph design.
 *   - If you need pixel-perfect KaTeX glyphs, swap to SVG via MathJax later.
 */

const fs = require("fs");
const path = require("path");

// Resolve katex from the mcp-server install (already present).
const katex = require(path.join(__dirname, "..", "penpot-plugin", "node_modules", "katex"));
const cssPath = require.resolve("katex/dist/katex.min.css", {
    paths: [path.join(__dirname, "..", "penpot-plugin", "node_modules")],
});

function parseArgs(argv) {
    const args = { tex: null, display: true, size: 22, color: "#1f2229" };
    const rest = [];
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--inline") { args.display = false; continue; }
        if (a === "--display") { args.display = true; continue; }
        if (a === "--size") { args.size = parseFloat(argv[++i]); continue; }
        if (a === "--color") { args.color = argv[++i]; continue; }
        rest.push(a);
    }
    args.tex = rest.join(" ");
    return args;
}

function main() {
    const args = parseArgs(process.argv);
    if (!args.tex) {
        console.error("usage: tex2html.js <LaTeX> [--inline] [--size N] [--color #hex]");
        process.exit(1);
    }

    let html;
    try {
        html = katex.renderToString(args.tex, {
            displayMode: args.display,
            throwOnError: true,
            output: "html",
        });
    } catch (e) {
        console.error("KaTeX render failed:", e.message);
        process.exit(2);
    }

    const css = fs.readFileSync(cssPath, "utf8");

    // Self-contained snippet — inline <style> + the KaTeX HTML, wrapped in a
    // sizing div. HTML TO DESIGN should accept the whole blob.
    const out = `<style>${css}</style><div style="font-size:${args.size}px;color:${args.color};line-height:1.2;">${html}</div>`;

    process.stdout.write(out);
}

main();
