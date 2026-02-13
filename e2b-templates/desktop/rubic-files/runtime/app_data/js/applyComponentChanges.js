"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsxLoc = parseJsxLoc;
exports.applyComponentChanges = applyComponentChanges;
exports.applyDeleteChange = applyDeleteChange;
exports.applySrcChange = applySrcChange;
exports.applyHrefChange = applyHrefChange;
exports.applyTextChange = applyTextChange;
exports.applyClassChange = applyClassChange;
exports.applyStyleChange = applyStyleChange;
const magic_string_1 = __importDefault(require("magic-string"));
function parseJsxLoc(jsxLoc) {
    // Parse "client/src/pages/Home.tsx:27" or "client/src/pages/Home.tsx:27:10"
    const parts = jsxLoc.split(":");
    const filePath = parts[0] || "";
    const line = Number.parseInt(parts[1] || "0", 10);
    const column = Number.parseInt(parts[2] || "0", 10);
    return { filePath, line, column };
}
function isValidUrl(url) {
    if (!url)
        return false;
    try {
        new URL(url);
        return true;
    }
    catch {
        // Relative paths are also valid
        return url.startsWith("/") || url.startsWith(".");
    }
}
function isSameUrl(url1, url2) {
    return url1 === url2;
}
function findTextInCode(text, code) {
    const results = [];
    let index = 0;
    while (index < code.length) {
        const found = code.indexOf(text, index);
        if (found === -1)
            break;
        results.push({ start: found, end: found + text.length });
        index = found + 1;
    }
    return results;
}
function formatStyleObject(styles) {
    return Object.entries(styles)
        .map(([key, value]) => {
        // Check if value needs quotes (contains spaces, commas, or special chars)
        const needsQuotes = /[\s,]/.test(value) || !value.match(/^[a-zA-Z0-9#.%-]+$/);
        if (needsQuotes) {
            // Escape single quotes and backslashes in values
            const escapedValue = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            return `${key}: '${escapedValue}'`;
        }
        else {
            // Simple values without quotes (e.g., numeric values for certain properties)
            return `${key}: '${value}'`;
        }
    })
        .join(", ");
}
async function applyComponentChanges(ast, code, magic, source, changes) {
    const updated = {
        src: false,
        href: false,
        text: false,
        class: false,
        style: false,
        deleted: false,
    };
    if (!code)
        return updated;
    const traverse = (await Promise.resolve().then(() => __importStar(require("@babel/traverse")))).default;
    traverse(ast, {
        JSXElement({ node }) {
            const opening = node.openingElement;
            // Match by line number only if column is not provided (0), otherwise match both
            const lineMatches = opening.loc?.start.line === source.line;
            const columnMatches = source.column === 0 || opening.loc?.start.column === source.column - 1;
            if (lineMatches && columnMatches) {
                if (changes.deleted) {
                    updated.deleted = applyDeleteChange(magic, node, code);
                }
                if (changes.src) {
                    updated.src = applySrcChange(magic, changes.src, node);
                }
                if (changes.href) {
                    updated.href = applyHrefChange(magic, changes.href, node);
                }
                if (changes.className) {
                    updated.class = applyClassChange(magic, changes.className, node);
                }
                if (changes.textContent) {
                    updated.text = applyTextChange(magic, changes.textContent, node, code);
                }
                if (changes.style) {
                    updated.style = applyStyleChange(magic, changes.style, node);
                }
            }
        },
    });
    return updated;
}
function applyDeleteChange(magic, node, code) {
    if (node.start === null ||
        node.end === null ||
        node.start === undefined ||
        node.end === undefined) {
        return false;
    }
    // Find the start position, including any leading whitespace on the same line
    let start = node.start;
    let end = node.end;
    // Look backwards to find the start of the line or first non-whitespace
    while (start > 0 && code[start - 1] !== "\n") {
        const char = code[start - 1];
        if (char === " " || char === "\t") {
            start--;
        }
        else {
            break;
        }
    }
    // If we're at a newline, include it in the deletion
    if (start > 0 && code[start - 1] === "\n") {
        start--;
    }
    // Look forward to consume trailing whitespace up to (and including) the next newline
    while (end < code.length && (code[end] === " " || code[end] === "\t")) {
        end++;
    }
    if (end < code.length && code[end] === "\n") {
        end++;
    }
    // Remove the element
    magic.remove(start, end);
    return true;
}
function applySrcChange(magic, change, node) {
    const { original, modified } = change;
    if (!isValidUrl(modified) || isSameUrl(original, modified)) {
        return false;
    }
    const src = node.openingElement.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === "src");
    if (src?.type === "JSXAttribute") {
        if (src.value?.type === "StringLiteral" && src.value.start && src.value.end) {
            // src=""
            magic.update(src.value.start, src.value.end, `"${modified}"`);
            return true;
        }
        else if (
        // src={""}
        src.value?.type === "JSXExpressionContainer" &&
            src.value.expression?.type === "StringLiteral" &&
            src.value.expression?.start &&
            src.value.expression?.end) {
            magic.update(src.value.expression.start, src.value.expression.end, `"${modified}"`);
            return true;
        }
    }
    return false;
}
function applyHrefChange(magic, change, node) {
    const { original, modified } = change;
    if (!isValidUrl(modified) || isSameUrl(original, modified)) {
        return false;
    }
    const href = node.openingElement.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === "href");
    if (href?.type === "JSXAttribute") {
        if (href.value?.type === "StringLiteral" && href.value.start && href.value.end) {
            // href=""
            magic.update(href.value.start, href.value.end, `"${modified}"`);
            return true;
        }
        else if (
        // href={""}
        href.value?.type === "JSXExpressionContainer" &&
            href.value.expression?.type === "StringLiteral" &&
            href.value.expression?.start &&
            href.value.expression?.end) {
            magic.update(href.value.expression.start, href.value.expression.end, `"${modified}"`);
            return true;
        }
    }
    return false;
}
function applyTextChange(magic, change, node, code) {
    const original = change.original.trim();
    const modified = change.modified.trim();
    if (!original)
        return false;
    const slice = code.slice(node.start ?? 0, node.end ?? 0);
    if (findTextInCode(original, slice).length !== 1)
        return false;
    for (const child of node.children) {
        if (child.type === "JSXText") {
            const found = findTextInCode(original, child.value);
            if (found.length === 1 && child.start) {
                magic.update(child.start + found[0].start, child.start + found[0].end, modified);
                return true;
            }
        }
        else if (
        // {"hello world"}
        child.type === "JSXExpressionContainer" &&
            child.expression?.type === "StringLiteral") {
            const found = findTextInCode(original, child.expression.value);
            if (found.length === 1 && child.expression.start) {
                magic.update(child.expression.start + found[0].start, child.expression.start + found[0].end, `"${modified.replace(/\n/g, " ")}"`);
                return true;
            }
        }
    }
    return false;
}
function applyClassChange(magic, change, node) {
    const { modified } = change;
    if (!modified)
        return false;
    const className = node.openingElement.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === "className");
    if (className?.type === "JSXAttribute") {
        if (
        // className=""
        className.value?.type === "StringLiteral" &&
            className.value.start &&
            className.value.end) {
            magic.update(className.value.start, className.value.end, `"${modified}"`);
            return true;
        }
        else if (
        // className={""}
        className.value?.type === "JSXExpressionContainer" &&
            className.value.expression?.type === "StringLiteral" &&
            className.value.expression.start &&
            className.value.expression.end) {
            magic.update(className.value.expression.start, className.value.expression.end, `"${modified}"`);
            return true;
        }
    }
    return false;
}
function applyStyleChange(magic, styleChanges, node) {
    const style = node.openingElement.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === "style");
    // Build style object from changes - only take modified values
    const newStyles = {};
    for (const [property, change] of Object.entries(styleChanges)) {
        if (change && change.modified) {
            newStyles[property] = change.modified;
        }
    }
    if (Object.keys(newStyles).length === 0) {
        return false;
    }
    if (style?.type === "JSXAttribute") {
        // Style attribute exists - need to merge with existing styles
        if (style.value?.type === "JSXExpressionContainer" &&
            style.value.expression?.type === "ObjectExpression" &&
            style.value.expression.properties) {
            // Parse existing style object and merge with new styles
            const existingStyles = {};
            for (const prop of style.value.expression.properties) {
                if (prop.type === "ObjectProperty" && prop.key?.type === "Identifier") {
                    existingStyles[prop.key.name] = prop;
                }
            }
            // Update existing properties and track what was updated
            let updatedCount = 0;
            for (const [key, value] of Object.entries(newStyles)) {
                const existingProp = existingStyles[key];
                if (existingProp && existingProp.value?.start && existingProp.value?.end) {
                    // Update existing property value
                    const escapedValue = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                    magic.update(existingProp.value.start, existingProp.value.end, `'${escapedValue}'`);
                    updatedCount++;
                    delete existingStyles[key]; // Mark as updated
                }
            }
            // If we have properties that weren't in the existing object, append them
            const newProps = Object.entries(newStyles).filter(([key]) => !existingStyles[key] && newStyles[key]);
            if (newProps.length > 0 && style.value.expression.properties.length > 0) {
                const lastProp = style.value.expression.properties[style.value.expression.properties.length - 1];
                if (lastProp.end) {
                    const newPropsString = newProps
                        .map(([key, value]) => {
                        const escapedValue = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                        return `${key}: '${escapedValue}'`;
                    })
                        .join(", ");
                    magic.appendLeft(lastProp.end, `, ${newPropsString}`);
                    updatedCount += newProps.length;
                }
            }
            else if (newProps.length > 0 && style.value.expression.properties.length === 0) {
                // Empty style object, insert properties
                const start = style.value.expression.start;
                const end = style.value.expression.end;
                if (start && end) {
                    const styleString = formatStyleObject(newStyles);
                    magic.update(start, end, `{${styleString}}`);
                    return true;
                }
            }
            return updatedCount > 0;
        }
        else if (style.value?.start && style.value?.end) {
            // Style exists but is not an object expression, replace it
            const styleString = formatStyleObject(newStyles);
            magic.update(style.value.start, style.value.end, `{{${styleString}}}`);
            return true;
        }
    }
    else {
        // No style attribute exists - add one
        const attributes = node.openingElement.attributes;
        const styleString = formatStyleObject(newStyles);
        if (attributes.length > 0) {
            const lastAttr = attributes[attributes.length - 1];
            if (lastAttr.end) {
                magic.appendLeft(lastAttr.end, ` style={{${styleString}}}`);
                return true;
            }
        }
        else {
            // No attributes, insert after element name
            const nameEnd = node.openingElement.name.end;
            if (nameEnd) {
                magic.appendLeft(nameEnd, ` style={{${styleString}}}`);
                return true;
            }
        }
    }
    return false;
}
async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => {
            data += chunk;
        });
        process.stdin.on("end", () => {
            resolve(data);
        });
        process.stdin.on("error", reject);
    });
}
// Execute as CLI when run directly
if (require.main === module) {
    (async () => {
        try {
            const input = JSON.parse(await readStdin());
            const { code, edits } = input;
            if (!code || !Array.isArray(edits)) {
                console.error(JSON.stringify({ error: "Invalid input: code and edits are required" }));
                process.exit(1);
            }
            const { parse } = await Promise.resolve().then(() => __importStar(require("@babel/parser")));
            const ast = parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
            const magic = new magic_string_1.default(code);
            const results = [];
            for (const edit of edits) {
                const { line } = parseJsxLoc(edit.element?.jsxLoc || "");
                const updated = await applyComponentChanges(ast, code, magic, { line, column: 0 }, edit.changes || {});
                results.push(updated);
            }
            const modifiedContent = magic.toString();
            const hasChanges = modifiedContent !== code;
            console.log(JSON.stringify({ modifiedContent, hasChanges }));
        }
        catch (error) {
            console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
            process.exit(1);
        }
    })();
}
