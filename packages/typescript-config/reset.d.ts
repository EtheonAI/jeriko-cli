// Import ts-reset for safer default TypeScript types
// - JSON.parse() returns `unknown` instead of `any`
// - .filter(Boolean) properly narrows types
// - .includes() on const arrays accepts wider types
// - fetch().json() returns `unknown` instead of `any`
import "@total-typescript/ts-reset";
