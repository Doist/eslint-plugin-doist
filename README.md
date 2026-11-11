# eslint-plugin-doist

A collection of Doist ESLint rules.

# Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint@^9 --save-dev
```

Next, install `@todoist/eslint-plugin-doist` (the package basename stays unchanged):

```sh
npm install @todoist/eslint-plugin-doist --save-dev
```

# Usage

Version 2.0.2 supports ESLint `^8.57.0 || ^9.0.0` and the Node/npm versions in `package.json`.
Register the plugin in `eslint.config.cjs`:

```js
const doist = require('@todoist/eslint-plugin-doist');

module.exports = [{
    plugins: { '@todoist/doist': doist },
    rules: {
        '@todoist/doist/import-file-naming': ['error', { camelcase: ['png'] }],
    },
}];
```

The CommonJS entry point exports `rules`; it does not export preset configs.
Legacy eslintrc configurations use the plugin identifier `@todoist/doist` and
rule prefix `@todoist/doist/`. See [release and compatibility notes](docs/releasing.md)
before upgrading from the 1.x dependency used by `eslint-config`.

# Supported Rules

### [gettext-literal-arg](./docs/rules/gettext-literal-arg.md)
Enforce only string literals as arguments to our i18n helpers `_()`.

### [import-file-naming](./docs/rules/import-file-naming.md)
Enforce naming conventions when importing certain file types using ES6 modules.
### [static-path-literal-arg](./docs/rules/static-path-literal-arg.md)
Enforce only string literals as arguments to our static deployment tool `$static_path`.


# Add a new rule

Use [`generator-eslint`](https://www.npmjs.com/package/generator-eslint):

```
yo eslint:rule
```

Stick to the ESLint recomendations regarding [working with rules](https://eslint.org/docs/latest/developer-guide/working-with-rules) and [working with plugins](https://eslint.org/docs/latest/developer-guide/working-with-plugins).