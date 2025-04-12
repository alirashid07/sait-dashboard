import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // Allow any types
      "@typescript-eslint/no-unused-vars": "warn", // Demote to warning
      "@typescript-eslint/no-require-imports": "off", // Allow require() in i18n.js
      "react/no-unescaped-entities": "off", // Allow unescaped quotes
      "@next/next/no-img-element": "warn", // Demote img warning
      "@next/next/no-html-link-for-pages": "warn" // Demote <a> warning
    },
  },
];

export default eslintConfig;
