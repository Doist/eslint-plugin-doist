# eslint-plugin-doist

A collection of Doist ESLint rules.

# Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `eslint-plugin-doist`:

```sh
npm install eslint-plugin-doist --save-dev
```

# Usage

Add `doist` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "@doist/doist"
    ]
}
```

# Supported Rules

### [gettext-literal-arg](/docs/src/gettext-literal-arg.md)
Enforce only string literals as arguments to our i18n helpers `_()`.

### [import-file-naming](/docs/src/import-file-naming.md)
Enforce naming conventions when importing certain file types using ES6 modules.
### [static-path-literal-arg](/docs/src/static-path-literal-arg.md)
Enforce only string literals as arguments to our static deployment tool `$static_path`.


# Add a new rule

Use [`generator-eslint`](https://www.npmjs.com/package/generator-eslint):

```
yo eslint:rule
```

Stick to the ESLint recomendations regarding [working with Rules](https://eslint.org/docs/latest/developer-guide/working-with-rules) and [working with plugins](https://eslint.org/docs/latest/developer-guide/working-with-plugins).