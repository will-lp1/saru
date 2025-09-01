"use client";

import { MarkdownParser, defaultMarkdownSerializer, MarkdownSerializer } from "prosemirror-markdown";
import { Node as PMNode } from "prosemirror-model";
import markdownit from "markdown-it";

import { documentSchema } from "./basic-schema";

const md = markdownit("commonmark", { html: false, breaks: false, linkify: true });

const parser = new MarkdownParser(documentSchema, md, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (tok) => {
      const start = tok.attrGet("start");
      return { order: start ? +start : 1 };
    },
  },
  heading: { block: "heading", getAttrs: (tok) => ({ level: +tok.tag.slice(1) }) },
  code_block: { block: "code_block" },
  fence: { block: "code_block", getAttrs: (tok) => ({ params: tok.info }) },
  hr: { node: "horizontal_rule" },
  hardbreak: { node: "hard_break" },
  em: { mark: "em" },
  strong: { mark: "strong" },
  link: { mark: "link", getAttrs: (tok) => ({ href: tok.attrGet("href"), title: tok.attrGet("title") }) },
  code_inline: { mark: "code" },
  s: { mark: "strike" },
});

// ---------- Serializer ----------
const serializer = new MarkdownSerializer(
  { ...defaultMarkdownSerializer.nodes },
  { ...defaultMarkdownSerializer.marks, diffMark: { open: "", close: "" } }
);

export const buildDocumentFromContent = (markdown: string) => parser.parse(markdown);

export const buildContentFromDocument = (doc: PMNode) => serializer.serialize(doc);
