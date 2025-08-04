import * as cf from "https://esm.sh/jsr/@campfire/core";
import { showDialog } from "./dialog.js";

const themes = [
    { name: "Default", class: "default" },
    { name: "Coffee", class: "coffee" },
    { name: "Night", class: "night" }
];

const themeClasses = themes.map(itm => `theme-${itm.class}`);

const createThemeStore = (elt) => {
    const store = cf.store({ value: 'default' });
    store.on('update', (v) => {
        document.body.classList.remove(...themeClasses);
        const { value } = v;
        document.body.classList.add(`theme-${value}`);
        localStorage.setItem('theme', value);
        elt.querySelector('selected')?.removeAttribute('selected');
        elt.querySelector(`[value=${value}]`)?.setAttribute('selected', 'selected');
    })

    const theme = localStorage.getItem('theme');
    if (!theme && globalThis.matchMedia("(prefers-color-scheme: dark)")) {
        store.update('night');
    }
    else if (theme) store.update(theme);
    else store.update('default');

    return store;
}

const ThemeSelector = () => {
    const options = themes.map(itm =>
        cf.html`<option value="${itm.class}">${itm.name}</option>`)
        .join('');

    return cf.nu('select#theme-select')
        .html`${cf.r(options)}`
        .done();
}

globalThis.addEventListener('DOMContentLoaded', () => {
    const [dialog] = cf.select({ s: 'dialog' });
    const [themeSelect] = ThemeSelector();
    const themeStore = createThemeStore(themeSelect);

    const handleOk = () => {
        themeStore.update(themeSelect.value);
        dialog.close();
    }

    const [btn] = cf.nu('button').on('click', handleOk)
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

    const settingsBtn = cf.select({ s: '#settings-btn', single: true });
    settingsBtn.onclick = async () => await showDialog(elem);
});