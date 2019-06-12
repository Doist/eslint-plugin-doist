function isStringLiteral(node) {
    return node.type === "Literal" && typeof node.value === "string"
}

function requireStringLiteralArgs({ context, node, name, indexes = [0] } = {}) {
    if (node.callee.name === name) {
        for (var i = 0; i < indexes.length; i++) {
            var index = indexes[i]

            if (
                node.arguments[index] &&
                !isStringLiteral(node.arguments[index])
            ) {
                context.report(
                    node,
                    `${name} arguments[${index}] needs to be a string literal`
                )
            }
        }
    }
}

module.exports = {
    rules: {
        "static-path-literal-arg": {
            create: function(context) {
                return {
                    CallExpression(node) {
                        requireStringLiteralArgs({
                            name: "$static_path",
                            node,
                            context,
                            indexes: [0, 1]
                        })
                    }
                }
            }
        },
        "gettext-literal-arg": {
            create: function(context) {
                return {
                    CallExpression(node) {
                        requireStringLiteralArgs({
                            name: "_",
                            node,
                            context
                        })
                        requireStringLiteralArgs({
                            name: "_n",
                            node,
                            context,
                            indexes: [0, 1]
                        })
                        requireStringLiteralArgs({
                            name: "_x",
                            node,
                            context,
                            indexes: [0, 1]
                        })
                        requireStringLiteralArgs({
                            name: "_nx",
                            node,
                            context,
                            indexes: [0, 1, 2]
                        })
                    }
                }
            }
        }
    }
}
