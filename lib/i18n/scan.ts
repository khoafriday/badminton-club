// Finds the Vietnamese text in the source, so a test can check each piece has an English entry in en.ts.
// Used by en.test.ts only; it reads files, so it never runs in the app.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const VIETNAMESE = /[à-ỹÀ-Ỹđ]/;

/** String literals of one file, comments skipped. Template literals with ${} are not keys and are left out. */
export function stringLiterals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) break;
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2);
      if (i < 0) break;
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let text = "";
      let interpolated = false;
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          const next = src[j + 1];
          text += next === "n" ? "\n" : next;
          j += 2;
          continue;
        }
        if (c === "`" && src[j] === "$" && src[j + 1] === "{") {
          interpolated = true;
          // Skip the expression; nested braces are counted, nested strings are rare enough here.
          let depth = 0;
          for (; j < src.length; j++) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}" && --depth === 0) break;
          }
          j++;
          continue;
        }
        // A quote in JSX text (an apostrophe) never spans lines in a real string literal.
        if (c !== "`" && src[j] === "\n") break;
        text += src[j];
        j++;
      }
      if (!interpolated) out.push(text);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "i18n" || name === "testing" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every Vietnamese string literal under app/ and lib/, with the first file it appears in. */
export function vietnameseStrings(root: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of [...sourceFiles(join(root, "app")), ...sourceFiles(join(root, "lib"))]) {
    for (const s of stringLiterals(readFileSync(file, "utf8"))) {
      if (VIETNAMESE.test(s) && !found.has(s)) found.set(s, relative(root, file));
    }
  }
  return found;
}
