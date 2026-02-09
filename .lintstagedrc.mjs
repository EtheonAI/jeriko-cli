export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => [
    `eslint --fix ${files.map((f) => `"${f}"`).join(" ")}`,
    `prettier --write ${files.map((f) => `"${f}"`).join(" ")}`,
  ],
  "*.{json,md,yml,yaml}": (files) => [`prettier --write ${files.map((f) => `"${f}"`).join(" ")}`],
  "*.go": ["gofmt -w"],
};
