import { createElement } from "react";
import type { Thing, WithContext } from "schema-dts";

type JsonLdProps = {
  code: WithContext<Thing>;
};

const escapeJsonForHtml = (json: string): string =>
  json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const JsonLd = ({ code }: JsonLdProps) =>
  createElement("script", {
    dangerouslySetInnerHTML: {
      __html: escapeJsonForHtml(JSON.stringify(code)),
    },
    type: "application/ld+json",
  });

export * from "schema-dts";
