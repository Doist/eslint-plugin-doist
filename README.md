# eslint-plugin-doist

## Installation

```
$ npm install @doist/eslint-plugin-doist --save-dev
```


## Usage

```js
// Your ESLint configuration
{
  "plugins": [
    // ...
    "@doist/doist"
  ],
  "rules": {
    // ...
    "@doist/doist/static-path-literal-arg": "error",
    "@doist/doist/gettext-literal-arg": "error"
  }
}
```

## Rules

__@doist/doist/static-path-literal-arg__

The argument of `$static_path` call expression needs to be a single string literal.

```js
// good
$static_path("/static/images/icon.png")

// bad
$static_path("/static/images" + "icon.png")

// bad
const url = "/static/images/icon.png"
$static_path(url)
```
Why: our static deployment tool parse all code files for the `$static_path` usage in order to know which files should be uploaded to CDN. The parser cannot recognize call expression that contains non string-literal argument.


__@doist/doist/gettext-literal-arg__

The argument of `_()` call expression needs to be a single string literal.

```js
// good
_("Thank you")

// bad
const s = "Thank you"
_(s)

// bad
_("Thank " + "you")
```
Why: our localization tool parse all code files to look for localized strings, and the parser cannot recognize call expression that contains non string-literal argument.






