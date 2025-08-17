import { parseMd } from "./parse.js";
import { template } from "https://esm.sh/jsr/@campfire/core@4.0.3";

const detailsTemplate = template(`
        <h3>Preview "{{title}}"</h3>
        <div class=tags>
            <span class="tag invert">{{ edition }}</span>
            {{#nsfw}}<span class="tag danger invert">NSFW</span>{{/nsfw}}
        </div>
        <div>by <strong>{{author}}</strong></div>
        {{#notes}}
        <div class="nag"><strong>NOTES</strong>: {{notes}}</div>
        {{/notes}}
    `);

export const renderPreview = (elts, opts) => {
    if (!elts.details || !elts.preview) throw new Error("Both details and render target must be supplied!");
    elts.details.innerHTML = detailsTemplate({
        ...opts,
        edition: typeof opts.edition === 'string' ? opts.edition : opts.edition.name
    });
    elts.preview.innerHTML = parseMd(opts.content);
}