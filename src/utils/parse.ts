import { marked, Renderer } from "marked";
import sanitize from "sanitize-html";
import { markedSmartypants } from "marked-smartypants";

let markedSetup = false;
const setupMarked = () => {
    if (markedSetup) return;
    markedSetup = true;
    const renderer: Partial<Renderer> = {
        heading({ tokens, depth }) {
            const text = this.parser?.parseInline(tokens);
            return `<div class='heading-${depth}'>${text}</div>`;
        },
        image() {
            return "";
        },
    };
    marked.use({ renderer });
    marked.use(markedSmartypants());
};

export function parseMd(markdown: string) {
    setupMarked();

    return sanitize(marked.parse(markdown), {
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
            a: (tagName: string, attribs: Record<string, string>) => {
                if (attribs.target === "_blank") {
                    attribs.rel = "noopener noreferrer";
                }
                return { tagName, attribs };
            },
        },
    });
}
