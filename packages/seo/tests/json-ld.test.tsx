import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { JsonLd } from "../json-ld";

type JsonLdElementProps = {
  dangerouslySetInnerHTML: {
    __html: string;
  };
  type: string;
};

describe("JsonLd", () => {
  it("escapes JSON-LD for safe inline script rendering", () => {
    const element = JsonLd({
      code: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        description: "</script><script>alert(1)</script>",
        name: "Jeriko",
      },
    }) as ReactElement<JsonLdElementProps>;

    expect(element.props.type).toBe("application/ld+json");
    expect(element.props.dangerouslySetInnerHTML.__html).toContain("\\u003c/script\\u003e");
    expect(element.props.dangerouslySetInnerHTML.__html).not.toContain("</script><script>");
  });
});
