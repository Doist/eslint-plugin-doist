/* eslint-disable eslint-plugin/prefer-message-ids */
/**
 * @fileoverview Enforce only string literals as arguments to our static deployment tool `$static_path`
 * @author Doist Frontend
 */
"use strict";

const { requireStringLiteralArgs } = require("../helpers");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce only string literals as arguments to our static deployment tool `$static_path`",
            recommended: false,
            url: "/docs/rules/static-path-literal-arg.md", // URL to the documentation page for this rule
        },
        schema: [], // Add a schema if the rule has options
    },

    create(context) {
        return {
            CallExpression(node) {
                requireStringLiteralArgs({
                    name: "$static_path",
                    node,
                    context,
                    indexes: [0, 1],
                });
            },
        };
    },
};
