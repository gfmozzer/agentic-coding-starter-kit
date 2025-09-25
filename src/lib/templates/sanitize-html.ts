import sanitizeHtml from "sanitize-html";
import type { IOptions } from "sanitize-html";

const BASE_ALLOWED_TAGS = new Set<string>([
  ...(sanitizeHtml.defaults.allowedTags ?? []),
  "img",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "iframe",
]);

const allowedTags = Array.from(BASE_ALLOWED_TAGS);

const allowedAttributes: IOptions["allowedAttributes"] = {
  ...(sanitizeHtml.defaults.allowedAttributes ?? {}),
  "*": [
    "class",
    "style",
    "id",
    "data-*",
    "aria-*",
    "role",
    "title",
  ],
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "width", "height", "loading"],
  iframe: ["src", "width", "height", "style", "loading"],
};

export function sanitizeRenderTemplateHtml(html: string): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "data", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
      iframe: ["http", "https"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        { rel: "noopener noreferrer" },
        true
      ),
    },
  });

  return sanitized.trim();
}
