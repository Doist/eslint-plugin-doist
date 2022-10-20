# Enforce naming conventions when importing given file types (import-file-naming)

Examples of **incorrect** code for this rule:

```js
/* '@doist/doist/import-file-naming': ['error', { camelcase: ['jpg'] }] */
import LoremPhoto from './lorem-photo.png'
```

Examples of **correct** code for this rule:

```js
/* '@doist/doist/import-file-naming': ['error', { camelcase: ['jpg'] }] */
import loremPhoto from './lorem-photo.png'
```

## Options

`import-file-naming` requires an options object with:
- keys that declare a supported naming convention:
    - `camelcase`
    - `kebabcase`
    - `pascalcase`
    - `snakecase`
- values that declare the file extensions to which the convention applies.

For example, to enforce PascalCase on *.svg and *.mp4 imports and camelCase on *.png imports, declare:

```
'@doist/doist/import-file-naming': ['error', { 
    pascalcase: ['svg', 'mp4'], 
    camelcase:  ['png'],
}]
```