export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => {
    const filtered = files.filter((f) => !f.includes("e2b-templates/"));
    if (filtered.length === 0) return [];
    return [
      `eslint --fix ${filtered.map((f) => `"${f}"`).join(" ")}`,
      `prettier --write ${filtered.map((f) => `"${f}"`).join(" ")}`,
    ];
  },
  "*.{json,md,yml,yaml}": (files) => [`prettier --write ${files.map((f) => `"${f}"`).join(" ")}`],
  "*.go": ["gofmt -w"],
};
