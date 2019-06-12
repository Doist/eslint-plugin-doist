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
