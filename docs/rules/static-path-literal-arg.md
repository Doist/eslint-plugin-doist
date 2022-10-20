# Enforce only string literals as arguments to our static deployment tool `$static_path` (static-path-literal-arg)

Our static assets deployment tool parses all code files for the `$static_path`. The parser cannot recognize call expressions containing non string-literal argument.

Examples of **incorrect** code for this rule:

```js
$static_path("/static/images" + "icon.png")
```

Examples of **correct** code for this rule:

```js
$static_path("/static/images/icon.png")
```
