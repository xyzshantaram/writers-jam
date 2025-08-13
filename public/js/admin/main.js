import { ApiClient } from '../api-client.js';
import { message, confirm, fatal } from 'https://esm.sh/cf-alert@0.4.1';
import * as cf from "https://esm.sh/jsr/@campfire/core@4.0.2";
import { renderPreview } from '../preview.js';

const getFormJson = (form) => {
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

const UserInfo = (username) => {
    const [logoutBtn] = cf.nu("a#logout-btn")
        .misc('href', 'javascript:void(0)')
        .attr('aria-role', 'button')
        .on("click", async () => {
            const api = ApiClient.getInstance();
            try {
                await api.logout();
                await message('Logged out successfully', 'Success');
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                console.error('Logout error:', error);
                api.clearToken();
                location.reload();
            }
        })
        .content("Logout")
        .done();

    return cf.nu("div.user-info")
        .style('display', 'inline')
        .html`
            <span>Logged in as: <strong>${username}</strong></span>
            <cf-slot name="logout"></cf-slot>
        `
        .children({ logout: logoutBtn })
        .done();
};

const setupLogin = async () => {
    const api = ApiClient.getInstance();
    const loginForm = document.querySelector('#login-form');
    const isAuthenticated = await api.validateAuth();
    if (isAuthenticated) {
        const { success, user } = await api.whoami();
        if (success && user) {
            const [summary] = cf.select({ s: 'details:has(#login-form)>summary' });
            const [userInfo] = UserInfo(user.username);

            summary.innerHTML = '';
            cf.insert(userInfo, { into: summary });
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = getFormJson(loginForm);

        if (!data.username?.trim() || !data.password) {
            await message('Please enter both username and password', 'Error');
            return;
        }

        try {
            const isSignup = data.signupCode && data.signupCode.trim() !== "";
            await api.authenticate(data, isSignup);
            await message('Authentication successful!', 'Success');
            // Reload the page to show the authenticated state
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Authentication failed');
            await fatal(msg, 'Error');
        }
    });
}

const extractPostId = (input) => {
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

const actionId = cf.ids('status');

const setupPostMgmt = () => {
    const store = cf.store({ value: { id: null, data: null } });

    setupManageBtn(store);
    setupPostDelete(store);
    setupEditCodeReset(store);
    setupToggleNsfw(store);
};

class ManageBtns {
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

function setStatus(msg) {
    const [el] = cf.select({ s: '#last-action-result' });
    const id = actionId();
    cf.x(el)
        .attr('data-result-id', id)
        .content(msg)
        .done();

    setTimeout(() => {
        if (el.getAttribute('data-result-id') === id) {
            cf.x(el).content("Ready").done();
        }
    }, 2000);
}

const loadPost = async (managing, postId) => {
    const api = ApiClient.getInstance();

    const [wrapper] = cf.select({ s: '.post-preview-wrapper' });
    const [details] = cf.select({ s: '#preview-details' });
    const [preview] = cf.select({ s: '#post-preview' });

    try {
        const result = await api.getPost(postId);
        managing.update({ id: postId, data: result.data });
        renderPreview({ details, preview }, result.data);
        wrapper.style.display = 'block';
        return true;
    } catch (error) {
        const { msg } = api.handleApiError(error, 'Failed to load post');
        await fatal(msg, 'Error');
        wrapper.style.display = 'none';
        return false;
    }
}

function setupManageBtn(managing) {
    const [btn] = cf.select({ s: '#manage-btn' });
    const [input] = cf.select({ s: '#admin-post-id' });

    btn.addEventListener('click', async () => {
        const inp = input.value.trim();
        if (!inp) {
            return await message('Please enter a post ID or URL', 'Error');
        }
        const postId = extractPostId(inp);
        await loadPost(managing, postId);
        setStatus('Fetched post successfully');
    });

    input.addEventListener('keyup', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        btn.click();
    });
}

function setupPostDelete(managing) {
    const api = ApiClient.getInstance();
    ManageBtns.delete.addEventListener('click', async () => {
        const current = managing.current();
        if (!current.id) {
            await message('No post selected', 'Error');
            return;
        }
        if (!await confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            return;
        }
        try {
            await api.deletePost(current.id);
            setStatus('Post deleted successfully');
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to delete post');
            await fatal(msg, 'Error');
        }
    });
}

function setupEditCodeReset(managing) {
    const api = ApiClient.getInstance();
    ManageBtns.reset.addEventListener('click', async () => {
        const current = managing.current();
        if (!current.id) {
            await message('No post selected', 'Error');
            return;
        }
        try {
            const result = await api.resetPostEditCode(current.id);
            setStatus(`New edit code: ${result.data.newEditCode}`);
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to reset edit code');
            await fatal(msg, 'Error');
        }
    });
}

function setupToggleNsfw(managing) {
    const api = ApiClient.getInstance();
    ManageBtns.toggleNsfw.addEventListener('click', async () => {
        const current = managing.current();
        if (!current.id) {
            await message('No post selected', 'Error');
            return;
        }
        try {
            const updated = !current.data.nsfw;
            await api.setPostNsfw(current.id, updated);
            await loadPost(managing, current.id);
            setStatus(`Post ${updated ? 'marked as NSFW' : 'marked as SFW'}`);
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to toggle NSFW status');
            message(msg, "Error");
        }
    });
}

globalThis.addEventListener('DOMContentLoaded', async () => {
    const api = ApiClient.getInstance();

    await setupLogin(api);
    await setupPostMgmt(api);
});
