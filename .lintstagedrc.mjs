function escapeGlobChars(files) {
  return files.map((f) => f.replace(/[()[\]{}]/g, "\\$&"));
}

export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => [`prettier --write ${escapeGlobChars(files).join(" ")}`],
  "*.{json,md,yml,yaml}": (files) => [`prettier --write ${escapeGlobChars(files).join(" ")}`],
  "*.go": ["gofmt -w"],
};
