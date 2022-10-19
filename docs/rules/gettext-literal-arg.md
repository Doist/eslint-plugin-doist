# Enforce only string literals as arguments to our i18n helper `_()` (gettext-literal-arg)

The argument of our i18n helpers must be called with a single string literal.
Our localization tool parses all code files to look for localized strings. The parser cannot recognize call expressions containing non string-literal argument.

Examples of **incorrect** code for this rule:

```js
_("Thank " + "you")
```

Examples of **correct** code for this rule:

```js
_("Thank you")
```
