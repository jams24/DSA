// Build-time markdown → HTML with shiki highlighting. Server only.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { codeToHtml } from "shiki";

const THEME = "tokyo-night";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypePrettyCode, { theme: THEME, keepBackground: false, defaultLang: { block: "text" } })
  .use(rehypeStringify);

export async function renderMarkdown(md: string): Promise<string> {
  "use cache";
  return String(await processor.process(md));
}

export async function highlight(code: string, lang: string): Promise<string> {
  "use cache";
  return codeToHtml(code.trim(), { lang: lang === "text" ? "text" : lang, theme: THEME });
}
