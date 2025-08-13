import { ApiClient } from '../api-client.js';
import { message, confirm, fatal } from 'https://esm.sh/cf-alert@0.4.1';
import * as cf from "https://esm.sh/jsr/@campfire/core@4.0.2";
import { renderPreview } from '../preview.js';
import { getFormJson, extractPostId, ManageBtns } from "./utils.js";
import { showDialog } from "../dialog.js";
import { parseMd } from "../parse.js";

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

const actionId = cf.ids('status');

const setupPostMgmt = () => {
    const store = cf.store({ value: { id: null, data: null } });

    setupManageBtn(store);
    setupPostDelete(store);
    setupEditCodeReset(store);
    setupToggleNsfw(store);
};

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

const CommentConfirmation = (comment, close) => {
    const api = ApiClient.getInstance();

    const [elt, cnf, cancel] = cf.nu('div.comment-confirmation')
        .html`
        Are you sure you want to delete this comment?
        
        <div class=comment-preview>
            <div class=comment-author>${comment.author}</div>
            <div class=comment-body>${cf.r(parseMd(comment.content))}</div>
        </div>
        
        <div class='form-group submit-group'>
            <button class='cnf-cancel'>Cancel</button>
            <button class='cnf-ok danger'>Delete</button>
        </div>
        `
        .gimme('.cnf-ok', '.cnf-cancel')
        .done();

    cnf.onclick = async () => {
        await api.deleteComment(comment.id);
        close();
        await message('Comment deleted successfully.', 'Success');
    }

    cancel.onclick = () => close();

    return elt;
}

function setupCommentMgmt() {
    const api = ApiClient.getInstance();
    const [input] = cf.select({ s: "#admin-comment-id" });
    const [btn] = cf.select({ s: '#delete-comment-btn' });

    btn.onclick = async () => {
        const value = input.value.trim();
        if (!value) return;
        let [, ulid] = value.match(/#post-comment-(.{26})/) || [];
        if (!ulid && !(ulid = value).length === 26) {
            return await message("Invalid comment ID.", "Error");
        }
        try {
            const comment = await api.getComment(ulid);
            const [dialog] = cf.select({ s: 'dialog' });
            showDialog(CommentConfirmation(comment.data, () => dialog.close()));
        }
        catch (e) {
            const { msg } = api.handleApiError(e, "Error deleting comment.");
            await message(msg, 'Error');
        }
    }
}

const EditionList = (editions) => cf.nu('div.editions-list')
    .deps({ editions })
    .render(({ editions }, { b }) =>
        b.html`<ol class="edition-items">
            ${cf.r(editions
            .toSorted((a, b) => a.id - b.id)
            .slice(1)
            .map(edition => `
                <li class="edition-item" data-id="${edition.id}">
                    <span class="edition-name">${edition.name}</span>
                </li>
            `).join(''))}
        </ol>`
    )
    .done();

function setupEditionMgmt() {
    const api = ApiClient.getInstance();
    const editions = cf.store({ type: 'list', value: [] });
    const [list] = EditionList(editions);
    cf.select({ s: '.editions-wrapper' })[0].append(list);

    editions.on('update', (e) => {
        console.log(e)
    })

    const [input] = cf.select({ s: "#admin-edition-name" });
    const [btn] = cf.select({ s: '#add-edition-btn' });

    const loadEditions = async () => {
        try {
            const result = await api.getEditions();
            editions.update(result.data);
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to load editions');
            await message(msg, 'Error loading editions');
        }
    };

    btn.onclick = async () => {
        const name = input.value.trim();
        if (!name) return await message('Please enter an edition name', 'Error');

        try {
            await api.createEdition(name);
            input.value = '';
            await loadEditions();
            await message("Edition created successfully. The server will restart in 15 seconds.");
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to create edition');
            await fatal(msg, 'Error');
        }
    };

    input.addEventListener('keyup', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        btn.click();
    });

    loadEditions();
}

globalThis.addEventListener('DOMContentLoaded', async () => {
    await setupLogin();
    setupPostMgmt();
    setupCommentMgmt();
    setupEditionMgmt();
});
