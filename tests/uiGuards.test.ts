// Guards for the UI rules (spec: "UI rules"):
// (a) the engine stays pure TypeScript: no React, no DOM, no imports from src/ui;
// (b) the UI never hard-codes a displayed number: no digits in JSX text, and no "number + unit" inside
//     UI string literals. Design inputs (starters.ts, designOps.ts) are exempt: they are not displayed data.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(name) ? [p] : [];
  });
}

const rel = (p: string) => relative(root, p).replace(/\\/g, '/');

describe('engine purity', () => {
  it('src/engine imports no React, DOM or UI code', () => {
    const bad: string[] = [];
    for (const p of files(join(root, 'src/engine'), /\.ts$/)) {
      const src = readFileSync(p, 'utf8');
      if (/from ['"](react|react-dom)/.test(src) || /from ['"][./]*ui\//.test(src)) bad.push(`${rel(p)}: imports UI code`);
      if (/\b(document|window|localStorage)\./.test(src)) bad.push(`${rel(p)}: uses the DOM`);
    }
    expect(bad).toEqual([]);
  });
});

describe('UI shows engine numbers only', () => {
  const uiFiles = files(join(root, 'src/ui'), /\.tsx?$/).filter((p) => !/(starters|designOps)\.ts$/.test(p));

  it('no digits in JSX text', () => {
    const bad: string[] = [];
    for (const p of uiFiles.filter((x) => x.endsWith('.tsx'))) {
      const src = readFileSync(p, 'utf8');
      // Text between a tag's ">" and the next "<" that is not inside a {...} expression.
      for (const m of src.matchAll(/>([^<>{}]*)</g)) {
        const text = m[1]!;
        if (/;|\|\||&&|\?|=>/.test(text)) continue; // a comparison operator in code, not JSX text
        if (/\d/.test(text)) bad.push(`${rel(p)}: "${text.trim()}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no "number + unit" inside UI string literals', () => {
    const unit = /(^|[^\w.#-])[+−-]?\d[\d,.]*\s?(%|kg|W\b|m\/s|km\b|km\/s|m²|days?\b|Gbit|Mbit|\$|M\b|AU\b|min\b|h\b)/;
    // Not displayed numbers: SVG path data, regex replacement patterns ("$1 $2"), CSS percentages and transforms,
    // and the unit definition inside an equation ("1 AU").
    const exempt = (body: string) => /^[MmLlHhVvCcSsQqAaZz0-9.,\s-]+$/.test(body) || /^(\$\d\s?)+$/.test(body) || /^\d+(\.\d+)?%$/.test(body) || /^[a-zA-Z]+\(-?\d+(\.\d+)?%\)$/.test(body);
    const EQUATION_UNITS = ['(1 AU / r)'];
    const bad: string[] = [];
    for (const p of uiFiles) {
      const src = readFileSync(p, 'utf8')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
        let body = m[2]!.replace(/\$\{[^}]*\}/g, '');
        for (const e of EQUATION_UNITS) body = body.replace(e, '');
        if (!exempt(body) && unit.test(body)) bad.push(`${rel(p)}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
