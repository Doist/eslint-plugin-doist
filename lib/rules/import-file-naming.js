/**
 * @fileoverview Enforce naming conventions when importing given file types
 * @author Doist Frontend
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Enforce naming conventions when importing given file types",
            recommended: false,
            url: '/docs/import-file-naming.md',
        },
        schema: [
            {
                type: "object",
                properties: {
                    camelcase: { type: "array" },
                    kebabcase: { type: "array" },
                    pascalcase: { type: "array" },
                    snakecase: { type: "array" }
                },
                additionalProperties: false
            }
        ],
        messages: {
            useConvention: "Use {{convention}} when importing {{extensions}} files."
        }
    },

    create(context) {
        // based on https://github.com/dolsem/eslint-plugin-filename-rules
        const conventions = {
            camelcase: /^[a-z]+((\d)|([A-Z0-9][a-z0-9]+))*([A-Z])?(?:\..*)?$/,
            kebabcase: /^([a-z]+-)*[a-z]+(?:\..*)?$/,
            pascalcase: /^[A-Z]([A-Z0-9]*[a-z]+)+[A-Z0-9]*(?:\..*)?$/,
            snakecase: /^([a-z]+_)*[a-z]+(?:\..*)?$/
        }

        //----------------------------------------------------------------------
        // Helpers
        //----------------------------------------------------------------------

        function respectsConvention(content, convention) {
            const regex = conventions[convention]
            
            return regex.test(content)
        }
        
        function fileHasExtension(filename, extensions) {
            return extensions.some((ext) => filename.toLowerCase().endsWith(ext.toLowerCase()))
        }

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        return {
            ImportDeclaration(node) {
                const args = context.options[0]

                if (!args || args.length === 0) {
                    throw new Error("Rule options missing.")
                }

                Object.entries(args).forEach((arg) => {
                    const convention = arg[0]
                    const fileExtensions = arg[1]

                    if (fileHasExtension(node.source.value, fileExtensions)) {
                        node.specifiers.forEach((specifier) => {
                            if (
                                !respectsConvention(
                                    specifier.local.name,
                                    convention
                                )
                            ) {
                                context.report({
                                    node,
                                    messageId: "useConvention",
                                    data: {
                                        convention: convention,
                                        extensions: fileExtensions
                                            .join(", ")
                                            .replace(/,([^,]*)$/, " or$1")
                                    }
                                })
                            }
                        })
                    }
                })
            }
        }
    }
}