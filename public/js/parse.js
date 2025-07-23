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
    return sanitize(marked.parse(markdown), {
        allowedClasses: {
            "div": [
                "heading-1",
                "heading-2",
                "heading-3",
                "heading-4",
                "heading-5",
                "heading-6",
            ],
        },
    });
}
