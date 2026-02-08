function quoteFiles(files) {
  return files.map((f) => `"${f}"`).join(" ");
}

export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => [`prettier --write ${quoteFiles(files)}`],
  "*.{json,md,yml,yaml}": (files) => [`prettier --write ${quoteFiles(files)}`],
  "*.go": ["gofmt -w"],
};
