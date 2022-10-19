function isStringLiteral(node) {
    return node.type === "Literal" && typeof node.value === "string";
}

function requireStringLiteralArgs({ context, node, name, indexes = [0] } = {}) {
    if (node.callee.name === name) {
        for (var i = 0; i < indexes.length; i++) {
            var index = indexes[i];

            if (
                node.arguments[index] &&
                !isStringLiteral(node.arguments[index])
            ) {
                context.report(node, `${name} arguments[${index}] needs to be a string literal`);
            }
        }
    }
}

module.exports = {
    requireStringLiteralArgs,
};
