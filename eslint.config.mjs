import next from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import ts from "typescript-eslint";

export default [
	...ts.configs.recommended,
	{
		ignores: ["**/.next"],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		plugins: {
			react: react,
			"react-hooks": hooks,
			"@next/next": next,
		},
		rules: {
			...react.configs["jsx-runtime"].rules,
			...hooks.configs.recommended.rules,
			...next.configs.recommended.rules,
			...next.configs["core-web-vitals"].rules,
			"@next/next/no-img-element": "error",
		},
	},
];
