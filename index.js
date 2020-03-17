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

/*
 * ex:
 *   parsePlaceholders("{user} completed {num} tasks") // would return {"user", "num"}
 */
function parsePlaceholders(str) {
    var reg = /{([^}]+)}/g
    var placeholders = new Set()

    let res
    while ((res = reg.exec(str)) !== null) {
        placeholders.add(res[1])
    }

    return placeholders
}

/*
 * @param {Set} a
 * @param {Set} *
 */
function difference(a, b) {
    return new Set([...a].filter(x => !b.has(x)))
}

function pluralFormPlaceholderCheck({
    context,
    node,
    name,
    indexes = [0]
} = {}) {
    if (node.callee.name !== name) {
        return
    }

    const args = node.arguments

    const allPlacholders = indexes.reduce((set, index) => {
        return new Set([...set, ...parsePlaceholders(args[index].value)])
    }, new Set())

    indexes.forEach(index => {
        var arg = args[index]
        var str = arg.value
        var placeholders = parsePlaceholders(str)
        var missing = difference(allPlacholders, placeholders)

        if (missing.size > 0) {
            var commaList = [...missing].map(s => `"{${s}}"`).join(" ,")
            context.report(arg, `"${str}" missing placeholder: ${commaList}`)
        }
    })
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
        },
        "gettext-pluralform-placeholder": {
            create: function(context) {
                return {
                    CallExpression(node) {
                        pluralFormPlaceholderCheck({
                            name: "_n",
                            node,
                            context,
                            indexes: [0, 1]
                        })
                        pluralFormPlaceholderCheck({
                            name: "_nx",
                            node,
                            context,
                            indexes: [1, 2]
                        })
                    }
                }
            }
        }
    }
}
