import { isLikelyVSCodeHtml, maybeMarkdown } from "./detect-markdown.js";
import { Tally } from "@twocaretcat/tally-ts";
import TurndownService from "turndown";
import * as turndownGfm from "turndown-plugin-gfm";
import { initTutorial } from "./tutorial.js";
import { renderPreview } from "./preview.js";
import cf from "@campfire/core";

const tally = new Tally();

globalThis.addEventListener("DOMContentLoaded", async () => {
    const textarea = document.querySelector("textarea");
    const wc = document.querySelector("#content-word-count");
    let timeout = null;

    const turndownService = new TurndownService({
        headingStyle: "atx",
    });

    turndownService.use([turndownGfm.gfm, turndownGfm.strikethrough, turndownGfm.taskListItems]);

    function htmlToMarkdown(html) {
        return turndownService.turndown(html);
    }

    textarea.addEventListener("paste", (e) => {
        const clipboardData = e.clipboardData || globalThis.clipboardData;
        if (!clipboardData) return;

        const htmlData = clipboardData.getData("text/html");
        const textData = clipboardData.getData("text/plain");

        if (htmlData && !isLikelyVSCodeHtml(textData) && !maybeMarkdown(textData)) {
            e.preventDefault();
            const markdown = htmlToMarkdown(htmlData);
            insertMarkdownAtCursor(markdown);
        }
    });

    function insertMarkdownAtCursor(markdown) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        textarea.value = value.slice(0, start) + markdown + value.slice(end);
        const newCursorPos = start + markdown.length;
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        textarea.focus();
    }

    const oninput = () => {
        const value = textarea.value;
        if (!value.trim()) {
            wc.textContent = "0";
            return;
        }
        wc.textContent = String(tally.countWords(value, "words").total);
    };

    const listener = () => {
        if (timeout) globalThis.clearTimeout(timeout);
        timeout = globalThis.setTimeout(oninput, 500);
    };

    textarea.addEventListener("input", listener);
    textarea.addEventListener("keyup", (e) => {
        if (e.key === "Backspace") {
            listener();
        }
    });

    oninput();
    const tutorialShown = localStorage.getItem("tutorial-shown");
    if (!tutorialShown) {
        await initTutorial();
        localStorage.setItem("tutorial-shown", true);
    }

    const tutorialNag = document.querySelector("#tutorial-nag");
    tutorialNag.onclick = async () => {
        await initTutorial();
    }
});

globalThis.addEventListener('DOMContentLoaded', () => {
    const [previewBtn] = cf.select({ s: "#preview-btn" });
    const [previewCancelBtn] = cf.select({ s: '#preview-cancel-btn' });
    const [detailsContainer] = cf.select({ s: '#post-details' });
    const [confirmationContainer] = cf.select({ s: '#post-confirmation' });
    const [previewDetails] = cf.select({ s: '#preview-details' });
    const [preview] = cf.select({ s: "#post-preview" });
    const [textarea] = cf.select({ s: "textarea" });

    const updatePreview = () => {
        const title = document.querySelector('#post-title')?.value || "Untitled";
        const author = document.querySelector('#post-author')?.value || "Anonymous";
        const edSelect = document.querySelector('#post-edition');
        const edition = edSelect?.selectedOptions?.[0]?.textContent || "";
        const notes = document.querySelector('#post-tws')?.value || "";
        const nsfw = !!document.querySelector('#post-nsfw')?.checked;
        const content = textarea.value.trim();

        renderPreview(
            { details: previewDetails, preview },
            { title, author, edition, notes: notes.trim(), nsfw, content }
        );
    }

    previewBtn.addEventListener('click', () => {
        detailsContainer.style.display = 'none';
        confirmationContainer.style.display = 'contents';
        updatePreview();
    });

    previewCancelBtn.addEventListener('click', () => {
        detailsContainer.style.display = 'contents';
        confirmationContainer.style.display = 'none';
    });
})
