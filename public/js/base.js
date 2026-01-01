// deno-lint-ignore-file no-import-prefix
import * as cf from "https://esm.sh/jsr/@campfire/core@4.0.3";
import { showDialog } from "./dialog.js";

const themes = [
    { name: "Default", class: "default" },
    { name: "Coffee", class: "coffee" },
    { name: "Night", class: "night" },
];

const themeClasses = themes.map((itm) => `theme-${itm.class}`);

const createThemeStore = (elt) => {
    const store = cf.store({ value: "default" });
    store.on("update", (v) => {
        document.body.classList.remove(...themeClasses);
        const { value } = v;
        document.body.classList.add(`theme-${value}`);
        localStorage.setItem("theme", value);
        elt.querySelector("[selected]")?.removeAttribute("selected");
        elt.querySelector(`[value='${value}']`)?.setAttribute("selected", "selected");
    });

    const theme = localStorage.getItem("theme");
    if (!theme && globalThis.matchMedia("(prefers-color-scheme: dark)").matches) {
        store.update("night");
    } else if (theme) store.update(theme);
    else store.update("default");

    return store;
};

const ThemeSelector = () => {
    const options = themes.map((itm) => cf.html`<option value="${itm.class}">${itm.name}</option>`)
        .join("");

    return cf.nu("select#theme-select")
        .html`${cf.r(options)}`
        .done();
};

const setupRandomButton = async (el, onClose) => {
    const linkItem = (label, href) => cf.nu('a.btn')
        .attr('href', href)
        .style('margin', '0.25rem')
        .style('margin-top', '0')
        .content(label)
        .ref();

    const params = new URLSearchParams(globalThis.location.search);
    let editionId = params.get("edition");

    if (!editionId) {
        const match = globalThis.location.pathname.match(/\/editions\/(\d+)/);
        if (match && !isNaN(parseInt(match[1]))) {
            editionId = match[1];
        }
    }

    const option = document.querySelector(`#search-edition option[value="${editionId}"]`);
    let name = option?.textContent.trim();

    if (!name && editionId) {
        name = await fetch(`/api/v1/editions/${editionId}`)
            .catch(e => console.error(e))
            .then(res => {
                if (!res.ok) throw new Error("Error while fetching");
                return res;
            })
            .then(res => res.json())
            .then(json => json.data.name);
    }

    if (!name) name = "Selected Edition";

    el.onclick = async (e) => {
        e.preventDefault();
        const links = [];
        // Current edition
        links.push(linkItem("Current edition", "/post/random?edition=current"));
        if (editionId) {
            links.push(linkItem(`Edition: ${name}`,
                `/post/random?edition=${editionId}`));
        }

        links.push(linkItem("All posts", "/post/random"));

        const [cancel] = cf.nu("button")
            .on("click", () => onClose())
            .content("Cancel")
            .done();

        const [container] = cf.nu("div")
            .style('display', 'flex')
            .style('flexDirection', 'column')
            .style('gap', '10px')
            .done();

        cf.insert(links, { into: container });

        const [content] = cf.nu("div.dialog-inner")
            .html`<h3 style="margin-top: 0">Random Post</h3>
                <p>View random post from:</p>
                <cf-slot name="links"></cf-slot>
                <div class="form-group submit-group" style="margin-top: 1rem;">
                    <cf-slot name="cancel"></cf-slot>
                </div>`
            .children({ cancel, links: container })
            .done();

        await showDialog(content);
    };
}

globalThis.addEventListener("DOMContentLoaded", () => {
    const [dialog] = cf.select({ s: "dialog" });
    const [themeSelect] = ThemeSelector();
    const themeStore = createThemeStore(themeSelect);

    const handleOk = () => {
        themeStore.update(themeSelect.value);
        dialog.close();
    };

    const [btn] = cf.nu("button").on("click", handleOk)
        .content("OK")
        .done();

    const [elem] = cf.nu("div.dialog-inner").html`
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
            close: btn,
        })
        .done();

    const settingsBtn = cf.select({ s: "#settings-btn", single: true });
    settingsBtn.onclick = async () => await showDialog(elem);

    const randomBtn = cf.select({ s: "#random-btn", single: true });
    setupRandomButton(randomBtn, () => dialog.close());
});
