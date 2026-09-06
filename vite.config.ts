import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const ROOT = resolve(import.meta.dirname);
const PAGES = resolve(ROOT, "pages");

type Strings = Record<string, Record<string, string>>;

/** Pretty URL → html entry, shared by the dev server rewrite and the sitemap. */
export const ROUTES: Record<string, string> = {
  "/": "index.html",
  "/zevent": "zevent.html",
  "/fr/": "fr/index.html",
  "/fr/zevent": "fr/zevent.html",
};

/**
 * Tiny templating for the multi-page build:
 *   <!--#include name-->  → pages/<name>.html (recursively expanded)
 *   {{key}}               → pages/strings.json[lang][key]
 * The page's language is read from its <html lang="…"> attribute, so every
 * entry file only carries its own <head> and pulls the shared app markup.
 */
function partials(): Plugin {
  const load = (): Strings => JSON.parse(readFileSync(resolve(PAGES, "strings.json"), "utf8")) as Strings;
  const expand = (html: string, lang: string, page: string, depth = 0): string => {
    if (depth > 8) throw new Error("partials: include loop");
    const all = load();
    const dict = { ...(all[lang] ?? {}), ...(all[`${lang}-${page}`] ?? {}) };
    const altLang = lang === "fr" ? "en" : "fr";
    return html
      .replace(/<!--#include\s+([\w-]+)\s*-->/g, (_, name: string) => {
        // "about" resolves to the per-language, per-page article (about-en, about-en-zevent…)
        const file = name === "about" ? `about-${lang}${page === "zevent" ? "-zevent" : ""}` : name;
        return expand(readFileSync(resolve(PAGES, `${file}.html`), "utf8"), lang, page, depth + 1);
      })
      .replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
        if (key === "altLang") return altLang;
        return dict[key] ?? m;
      });
  };
  return {
    name: "multiview-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const lang = /<html[^>]*\blang="([a-z]{2})"/i.exec(html)?.[1] ?? "en";
        const page = /<html[^>]*\bdata-page="zevent"/i.exec(html) ? "zevent" : "index";
        return expand(html, lang, page);
      },
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? "/").split("?")[0] ?? "/";
        const clean = path !== "/" && path.endsWith("/") && path !== "/fr/" ? path.slice(0, -1) : path;
        const entry = ROUTES[clean] ?? (clean === "/fr" ? ROUTES["/fr/"] : undefined);
        if (entry) req.url = `/${entry}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [partials()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/zevent": {
        target: "https://zevent.fr",
        changeOrigin: true,
        rewrite: () => "/api/",
      },
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: Object.fromEntries(Object.values(ROUTES).map((f) => [f.replace(/\.html$/, "").replace("/", "-"), resolve(ROOT, f)])),
    },
  },
});
