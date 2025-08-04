import * as cf from "https://esm.sh/jsr/@campfire/core";
import { showDialog } from "./dialog.js";

const themes = [
    { name: "Default", class: "default" },
    { name: "Coffee", class: "coffee" },
    { name: "Night", class: "night" }
];

globalThis.addEventListener('DOMContentLoaded', () => {
    const [dialog] = cf.select({ s: 'dialog' });

    const [themeSelect] = cf.nu('select#theme-select').html`
            ${cf.r(
        themes.map(itm =>
            cf.html`<option value="${itm.class}">${itm.name}</option>`
        ).join(''))}
            `.done();

    const themeStore = cf.store({ value: 'theme-default' });

    themeStore.on('update', (v) => {
        document.body.classList.remove(themes.map(itm => `theme-${itm.class}`));
        const { value } = v;
        document.body.classList.add(`theme-${value}`);
        localStorage.setItem('theme', value);
        themeSelect.querySelector('selected')?.removeAttribute('selected');
        themeSelect.querySelector(`[value=${value}]`)?.setAttribute('selected', 'selected');
    })

    const theme = localStorage.getItem('theme');
    if (theme) themeStore.update(theme);

    const [btn] = cf.nu('button').on('click', () => {
        themeStore.update(themeSelect.value);
        dialog.close();
    })
        .content("OK")
        .done();

    const [elem] = cf.nu('div.dialog-inner').html`
            <div class=form-group>
                <label for='theme-select'>Theme</label>
                <cf-slot name="theme"></cf-slot>
            </div>

            <div class="form-group submit-group">
                <cf-slot name="close"></cf-slot>
            </div>
        `
        .children({
            theme: themeSelect,
            close: btn
        })
        .done();

    const settingsBtn = document.querySelector('#settings-btn');

    settingsBtn.onclick = async () => {
        await showDialog(elem);
    }
});