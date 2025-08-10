import { marked } from "https://esm.sh/marked@^16.0.0";
import { markedSmartypants } from "https://esm.sh/marked-smartypants@1.1.10";
import sanitize from "https://esm.sh/sanitize-html@^2.17.0";

const renderer = {
    heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return `<div class='heading-${depth}'>${text}</div>`;
    },
    image() {
        return "";
    },
};

marked.use(markedSmartypants());
marked.use({ renderer });

export function parseMd(markdown) {
    const input = typeof markdown === "string" ? markdown : String(markdown ?? "");
    return sanitize(marked.parse(input), {
        allowedTags: [
            "address",
            "article",
            "aside",
            "footer",
            "header",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "hgroup",
            "main",
            "nav",
            "section",
            "blockquote",
            "dd",
            "del",
            "div",
            "dl",
            "dt",
            "figcaption",
            "figure",
            "hr",
            "li",
            "ol",
            "p",
            "pre",
            "ul",
            "a",
            "abbr",
            "b",
            "bdi",
            "bdo",
            "br",
            "cite",
            "code",
            "data",
            "dfn",
            "em",
            "i",
            "kbd",
            "mark",
            "q",
            "rb",
            "rp",
            "rt",
            "rtc",
            "ruby",
            "s",
            "samp",
            "small",
            "span",
            "strong",
            "sub",
            "sup",
            "time",
            "u",
            "var",
            "wbr",
            "caption",
            "col",
            "colgroup",
            "table",
            "tbody",
            "td",
            "tfoot",
            "th",
            "thead",
            "tr",
        ],
        allowedClasses: {
            "div": [
                "heading-1",
                "heading-2",
                "heading-3",
                "heading-4",
                "heading-5",
                "heading-6",
            ],
            "span": [
                "visible-space",
            ],
        },
        allowedAttributes: {
            a: ["href", "name", "target", "rel"],
        },
        transformTags: {
            a: (tagName, attribs) => {
                if (attribs.target === "_blank") {
                    attribs.rel = "noopener noreferrer";
                }
                return { tagName, attribs };
            },
        },
    });
}
