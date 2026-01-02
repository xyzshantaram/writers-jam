import * as cf from "@campfire/core";

export const getFormJson = (form) => {
    if (form instanceof HTMLElement && form.tagName === "FORM") {
        form = new FormData(form);
    }
    else if (!(form instanceof FormData)) {
        throw new Error("Non-form data passed to toJson!");
    }

    const result = {};
    for (const key of form.keys()) {
        const val = form.getAll(key);
        if (!val.length) continue;
        if (val.length === 1) result[key] = val[0];
        else result[key] = val;
    }

    return result;
}

export const extractPostId = (input) => {
    input = input.trim();

    // If it's a URL, try to extract the post ID
    if (input.startsWith('http://') || input.startsWith('https://')) {
        const url = new URL(input);
        const pathParts = url.pathname.split('/');
        const postIndex = pathParts.findIndex(part => part === 'post');
        if (postIndex !== -1 && postIndex + 1 < pathParts.length) {
            return pathParts[postIndex + 1];
        }
    }

    if (input.length === 8 && !isNaN(parseInt(input, 16))) {
        return input;
    }

    throw new Error("Invalid post ID.");
};

export class ManageBtns {
    static btns = {
        delete: null,
        reset: null,
        toggleNsfw: null,
    }

    static init = false;

    static get delete() {
        if (!ManageBtns.init) ManageBtns.initialize();
        return ManageBtns.btns.delete;
    }

    static get reset() {
        if (!ManageBtns.init) ManageBtns.initialize();
        return ManageBtns.btns.reset;
    }

    static get toggleNsfw() {
        if (!ManageBtns.init) ManageBtns.initialize();
        return ManageBtns.btns.toggleNsfw;
    }


    static initialize() {
        const [deleteBtn, reset, toggleNsfw] = cf.seq(1, 4)
            .map(itm =>
                cf.select({ s: `.manage-actions button:nth-child(${itm})`, single: true })
            );

        ManageBtns.btns = {
            delete: deleteBtn,
            reset,
            toggleNsfw
        };

        ManageBtns.init = true;
    }
}