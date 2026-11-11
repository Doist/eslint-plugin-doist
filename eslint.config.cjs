'use strict';

// Preserve the existing lint policy while supporting ESLint 8.57 and 9 flat config.
const { FlatCompat } = require('@eslint/eslintrc');
const { fixupConfigRules } = require('@eslint/compat');
const js = require('@eslint/js');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
});

module.exports = [
    ...fixupConfigRules(compat.config(require('./.eslintrc.js'))),
    { languageOptions: { ecmaVersion: 2022 } },
];
