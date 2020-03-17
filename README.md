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



__@doist/doist/gettext-pluralform-placeholder__


When localizing string with plural forms, the singular string should not contain the hard-coded number and should use have the same set of numeral placeholders as its plural form.

```js
// bad
_n("1 task completed", "{num} tasks completed", n)
_n("One task completed", "{num} tasks completed", n)

// good
_n("{num} task completed", "{num} tasks completed", n)
```

Why: It is incorrect to assume that the "singular" means "n=1" in all languages. In Russian language, its singular form is used for number ending with 1 (i.e. "1, 21, 31, 41, 51, 61, 71, 81, 101, 1001").

When you localize your singular form with number hardcoded in the string, (i.e. "One task completed"), the Russian translator would also provide translation with 'one' encoded in the translation. But this singular translation cannot be used when "n = 21".


_What if using placeholder in the singular isn't preferrable_

There will be times when using placeholder in singular might result in a less natural tone.

For instance, maybe we hope to say:

```
// Ideal for English, for not work for Russian
_n("Are you sure you want to delete this task?", "Are you sure you want to delete {num} tasks?", n)
``

In this scenario, you could create separate localized string without plural form dedicated for n = 1

```
if (n === 1) {
    return _("Are you sure you want to delete this task?")
} else {
    return _n("Are you sure you want to delete {num} task?", "Are you sure you want to delete {num} tasks?", n)
}
```
