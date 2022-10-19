/* eslint-disable eslint-plugin/prefer-message-ids */
/**
 * @fileoverview Enforce only string literals as arguments to our i18n helper `_()`
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
                "Enforce only string literals as arguments to our i18n helper `_()`",
            recommended: false,
            url: '/docs/rules/gettext-literal-arg.md',
        },
        schema: [], // Add a schema if the rule has options
    },

    create(context) {

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        return {
            CallExpression(node) {
                requireStringLiteralArgs({
                    name: "_",
                    node,
                    context,
                });
                requireStringLiteralArgs({
                    name: "_n",
                    node,
                    context,
                    indexes: [0, 1],
                });
                requireStringLiteralArgs({
                    name: "_x",
                    node,
                    context,
                    indexes: [0, 1],
                });
                requireStringLiteralArgs({
                    name: "_nx",
                    node,
                    context,
                    indexes: [0, 1, 2],
                });
            },
        };
    },
};
