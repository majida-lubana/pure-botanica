import js from "@eslint/js";
import globals from "globals";

export default [
  // Ignore files (replacement for .eslintignore)
  {
    ignores: ["node_modules/**", ".env"]
  },

  // Base recommended rules (converted safely)
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.es2021
      }
    }
  },

  // Backend (Node.js)
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn"
    }
  },

  // Frontend (Browser JS)
  {
    files: ["public/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
];
