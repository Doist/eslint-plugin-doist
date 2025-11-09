'use strict';

const js = require('@eslint/js');
const eslintPlugin = require('eslint-plugin-eslint-plugin');
const nodePlugin = require('eslint-plugin-n');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    eslintPlugin.configs['flat/recommended'],
    nodePlugin.configs['flat/recommended-script'],
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
    },
    {
        files: ['eslint.config.js'],
        rules: {
            'n/no-extraneous-require': 'off',
            'n/no-unpublished-require': 'off',
        },
    },
];
