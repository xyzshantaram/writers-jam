import { parseMd } from './parse.js';
import { maybeMarkdown, isLikelyVSCodeHtml } from './detect-markdown.js';
import { count } from "https://esm.sh/@wordpress/wordcount@^4.26.0";
import TurndownService from "https://esm.sh/turndown@7.2.0";
import * as turndownGfm from "https://esm.sh/turndown-plugin-gfm";
import { initTutorial } from "./tutorial.js";
import { template } from "https://esm.sh/jsr/@campfire/core@4.0.2";

globalThis.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.querySelector('textarea');
    const preview = document.querySelector('#post-preview');
    const wc = document.querySelector('#content-word-count');
    let timeout = null;

    const turndownService = new TurndownService({
        headingStyle: 'atx'
    });

    turndownService.use([turndownGfm.gfm, turndownGfm.strikethrough, turndownGfm.taskListItems]);

    function htmlToMarkdown(html) {
        return turndownService.turndown(html);
    }

    textarea.addEventListener('paste', (e) => {
        const clipboardData = e.clipboardData || globalThis.clipboardData;
        if (!clipboardData) return;

        const htmlData = clipboardData.getData('text/html');
        const textData = clipboardData.getData('text/plain');

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
        if (!value.trim()) return;
        preview.innerHTML = parseMd(value);
        wc.innerHTML = count(value, 'words');
    };

    const listener = () => {
        if (timeout) globalThis.clearTimeout(timeout);
        timeout = globalThis.setTimeout(oninput, 500);
    }

    textarea.addEventListener('input', listener);
    textarea.addEventListener('keyup', (e) => {
        if (e.key === 'Backspace') {
            listener();
        }
    })

    oninput();
    const tutorialShown = localStorage.getItem('tutorial-shown');
    if (!tutorialShown) {
        await initTutorial();
        localStorage.setItem('tutorial-shown', true);
    }

    const tutorialNag = document.querySelector('#tutorial-nag');
    tutorialNag.onclick = async () => {
        await initTutorial();
    }
});

globalThis.addEventListener('DOMContentLoaded', () => {
    const previewBtn = document.querySelector("#preview-btn");
    const previewCancelBtn = document.querySelector('#preview-cancel-btn');
    const detailsContainer = document.querySelector('#post-details');
    const confirmationContainer = document.querySelector('#post-confirmation');
    const previewDetails = document.querySelector('#preview-details');

    const previewTemplate = template(`
        <h3>Preview "{{title}}"</h3>
        <div class=badges>
            <span class="tag invert">{{ edition }}</span>
            {{#nsfw}}<span class="tag danger invert">NSFW</span>{{/nsfw}}
        </div>
        <div>by <strong>{{author}}</strong></div>
        {{#notes}}
        <div class="nag"><strong>NOTES</strong>: {{notes}}</div>
        {{/notes}}
    `);

    const updatePreview = () => {
        const title = document.querySelector('#post-title')?.value || "Untitled";
        const author = document.querySelector('#post-author')?.value || "Anonymous";
        const edSelect = document.querySelector('#post-edition');
        const edition = edSelect?.selectedOptions?.[0]?.textContent || "";
        const notes = document.querySelector('#post-tws')?.value || "";
        const nsfw = !!document.querySelector('#post-nsfw')?.checked;

        previewDetails.innerHTML = previewTemplate({
            title, author, edition, notes: notes.trim(), nsfw
        });
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