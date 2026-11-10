'use strict';

const assert = require('assert');
const plugin = require('../../lib');
const { ESLint } = require('eslint');
// eslint-plugin-node predates ESLint's package exports for this public entry point.
// eslint-disable-next-line node/no-missing-require
const { FlatESLint, LegacyESLint } = require('eslint/use-at-your-own-risk');
const eslintMajor = Number(require('eslint/package.json').version.split('.')[0]);
const rules = {
    '@todoist/doist/gettext-literal-arg': 'error',
    '@todoist/doist/static-path-literal-arg': 'error',
    '@todoist/doist/import-file-naming': ['error', { camelcase: ['png'] }],
};
const parserOptions = { ecmaVersion: 2022, sourceType: 'module' };
const examples = [
    {
        code: "_('text'); _n('one', 'many'); _x('text', 'context'); _nx('one', 'many', 'context');",
        ruleIds: [],
    },
    {
        code: "_(value); _n('one', value); _x(value, 'context'); _nx('one', 'many', value);",
        ruleIds: Array(4).fill('@todoist/doist/gettext-literal-arg'),
    },
    { code: "$static_path('/image.png', 'hash');", ruleIds: [] },
    { code: "$static_path(path, hash);", ruleIds: Array(2).fill('@todoist/doist/static-path-literal-arg') },
    { code: "import image from './image.png';", ruleIds: [] },
    { code: "import Wrong from './image.png';", ruleIds: ['@todoist/doist/import-file-naming'] },
];

describe('supported configuration formats', () => {
    const engines = {
        flat: new (eslintMajor >= 9 ? ESLint : FlatESLint)({
            overrideConfigFile: true,
            overrideConfig: [{
                languageOptions: parserOptions,
                plugins: { '@todoist/doist': plugin },
                rules,
            }],
        }),
        eslintrc: new (eslintMajor >= 9 ? LegacyESLint : ESLint)({
            useEslintrc: false,
            plugins: { '@todoist/doist': plugin },
            overrideConfig: {
                parserOptions,
                plugins: ['@todoist/doist'],
                rules,
            },
        }),
    };
    for (const [format, engine] of Object.entries(engines)) {
        for (const { code, ruleIds } of examples) {
            it(`${format}: ${code}`, async () => {
                const [result] = await engine.lintText(code);
                assert.deepStrictEqual(result.messages.map((message) => message.ruleId), ruleIds);
                assert.strictEqual(result.fatalErrorCount, 0);
            });
        }
    }
});
