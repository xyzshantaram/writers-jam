import { marked } from "marked";
import { markedSmartypants } from "marked-smartypants";
import sanitize from "sanitize-html";
import { escape } from "@campfire/core";

const renderer = {
    heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        return `<div class='heading-${depth}'>${text}</div>`;
    },
    image() {
        return "";
    },
    text(token) {
        if ('tokens' in token && token.tokens) {
            return this.parser.parseInline(token.tokens);
        }

        return escape(token.text);
    }
};

marked.use(markedSmartypants());
marked.use({ renderer });

export function parseMd(markdown) {
    const input = typeof markdown === "string" ? markdown : String(markdown ?? "");
    const parsed = marked.parse(input);
    return sanitize(parsed, {
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
