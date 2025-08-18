import { ApiClient } from '../api-client.js';
import { message, confirm, fatal, input } from 'https://esm.sh/cf-alert@0.4.1';
import * as cf from "https://esm.sh/jsr/@campfire/core@4.0.3";
import TimeAgo from "https://esm.sh/javascript-time-ago@2.5.11";
import en from "https://esm.sh/javascript-time-ago@2.5.11/locale/en";
import { renderPreview } from '../preview.js';
import { getFormJson, extractPostId, ManageBtns } from "./utils.js";
import { showDialog } from "../dialog.js";
import { parseMd } from "../parse.js";

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");

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

            // Show all management sections when authenticated
            const managementSections = document.querySelectorAll('.management-section');
            managementSections.forEach(section => {
                section.classList.add('authenticated');
            });
        }
    } else {
        // Hide all management sections when not authenticated
        const managementSections = document.querySelectorAll('.management-section');
        managementSections.forEach(section => {
            section.classList.remove('authenticated');
        });
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
    }, 5000);
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
        if (!await confirm(`Are you sure you want to delete the post "${current.data.title}" by "${current.data.author}"?`)) {
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

        if (!await confirm(`Are you sure you want to reset the edit code for the post "${current.data.title}" by "${current.data.author}"?`)) {
            return;
        }

        try {
            const result = await api.resetPostEditCode(current.id);
            setStatus(`New edit code: ${result.data.new_code}`);
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
        // If not a deep link, treat the whole input as the ULID candidate
        if (!ulid) ulid = value;
        // Strict ULID format (26 chars, Crockford base32 excluding I, L, O, U)
        const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
        if (!ULID_RE.test(ulid)) {
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

const SignupCodeList = (signupCodes) => cf.nu('div.signup-codes-list')
    .deps({ signupCodes })
    .render(({ signupCodes }, { b }) => {
        if (signupCodes.length === 0) {
            return b.html`
            <p>No codes generated in this session.</p>
            `;
        }

        return b.html`
            <div class="details-heading">
                <strong>Generated codes</strong>
            </div>
            <ul class="signup-codes-ul">
                ${cf.r(signupCodes.map(code => `
                    <li class="signup-code-item">
                        <code>${code.code}</code>
                        <small class="signup-code-meta">Created: ${new Date(code.createdAt).toLocaleString()}</small>
                    </li>
                `).join(''))}
            </ul>
        `;
    })
    .done();

function setupSignupCodeMgmt() {
    const api = ApiClient.getInstance();
    const signupCodes = cf.store({ type: 'list', value: [] });
    const [list] = SignupCodeList(signupCodes);

    const wrapper = document.querySelector('.signup-codes-wrapper');
    cf.insert(list, { into: wrapper });

    const [btn] = cf.select({ s: '#create-signup-code-btn' });

    btn.addEventListener('click', async () => {
        if (!await confirm('Are you sure you want to create a new signup code?')) {
            return;
        }

        try {
            const result = await api.createSignupCode();
            const newCode = {
                code: result.data.code || 'unknown',
                createdAt: new Date().toISOString()
            };

            signupCodes.update([newCode, ...signupCodes.current()]);

            await message('Signup code created successfully!', 'Success');
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to create signup code');
            await fatal(msg, 'Error');
        }
    });
}

function setupEditionMgmt() {
    const api = ApiClient.getInstance();
    const editions = cf.store({ type: 'list', value: [] });
    const [list] = EditionList(editions);
    cf.select({ s: '.editions-wrapper' })[0].append(list);

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

        if (!await confirm(
            cf.html`Are you sure you want to create an edition called "<em>${name}</em>"? 
                <strong>WARNING!</strong> This will restart the server!`, {
            yes: "Confirm",
            no: "Cancel"
        }, "Confirmation", false)) return;

        try {
            await api.createEdition(name);
            input.value = '';
            await message("Edition created successfully. The server will restart in 15 seconds.");
            setTimeout(() => location.reload(), 15000);
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

const parseLog = (log) => {
    const { action_type: action, target_type: ttype, admin_username: admin, created_at: time, target_title: title, target_id: id, details } = log;
    return { action, ttype, admin, title, time, id, details };
}


function formatAction(admin, action, target, title, id) {
    const classes = ['tag', 'invert'];
    if (action.includes('delete')) {
        classes.push('danger');
    }
    else if (action.includes('reset')) {
        classes.push('warning');
    }
    else if (action.includes('mark_nsfw')) {
        classes.push('accented');
    }
    return cf.html`
        <span class='tag invert'>${admin}</span>
        <span class='admin-action ${classes.join(' ')}'>${action.replace(/_/g, ' ')}</span>
        <strong class=action-target-type>${target[0].toUpperCase() + target.slice(1)}</strong>
        <span class='action-target gray'>${title ? `"${title}"` : '#' + id}</span>
    `;
}

const LogItem = ({ action, ttype, admin, title, time, id, details }) => cf.html`
    <li class="moderation-log-entry">
        <div>
            ${cf.r(formatAction(admin, action, ttype, title, id))}
            <span class='small gray'>${timeAgo.format(new Date(time * 1000))}</span>
        </div>

        ${details?.trim() ? cf.html`
            <div class="moderation-log-details"><strong>Details:</strong> ${details}</div>`
        : ''}
    </li>`;

const LogDisplay = (logs) => {
    return cf.nu('ul.moderation-log-list')
        .deps({ logs })
        .render(({ logs }, { b }) => {

            return b.html(logs.map(parseLog)
                .map((log) => LogItem(log)).join(''));
        })
        .done();
}

const updateLinkState = (link, state) => {
    if (!link) return;
    link.classList.toggle('disabled', state);
    link.setAttribute('aria-disabled', state.toString());
    if (!state) link.setAttribute('tabindex', '-1');
    else link.removeAttribute('tabindex');
}

const Pagination = (pagination, onPageChange) => {
    const PageLink = (name) => `<div>
        <a href='javascript:void(0)' class='page-link ${name.slice(0, 4).toLowerCase()}'>
            ${name}
        </a>
    </div>`
    const [group, prev, next] = cf.nu('div.paginate-group')
        .deps({ pagination })
        .html`
            ${cf.r(PageLink('Previous'))}
            <div class='pagination-state'></div>
            ${cf.r(PageLink('Next'))}`
        .render(({ pagination }, { elt }) => {
            const [state] = cf.select({ s: '.pagination-state', from: elt });
            if (state) state.textContent = `Page ${pagination.page} of ${pagination.total} `;

            const [prev, next] = [cf.tracked('mod-log-prev'), cf.tracked('mod-log-next')];
            updateLinkState(prev, pagination.page === 1);
            updateLinkState(next, pagination.page >= pagination.total);
        })
        .gimme('a.page-link.prev', 'a.page-link.next')
        .done();

    prev.onclick = () => {
        const p = pagination.current();
        if (p.page <= 1) return;
        onPageChange(p.page - 1);
    };

    next.onclick = () => {
        const p = pagination.current();
        if (p.page >= p.total) return;
        onPageChange(p.page + 1);
    };

    cf.track('mod-log-prev', prev);
    cf.track('mod-log-next', next);

    return group;
}

// Moderation Log Functions
const ModerationLogList = (logs, pagination, onPageChange) =>
    cf.nu('div.moderation-log-wrapper')
        .deps({ logs, pagination })
        .html`<cf-slot name='list'></cf-slot>
            <cf-slot name='controls'></cf-slot>`
        .children({
            list: LogDisplay(logs),
            controls: Pagination(pagination, onPageChange)
        })
        .done();

function setupDescriptionMgmt() {
    const api = ApiClient.getInstance();
    const [form] = cf.select({ s: 'details:has(#admin-update-desc) form' });
    const [textarea] = cf.select({ s: '#admin-update-desc' });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const description = textarea.value.trim();
        if (!description) {
            return await message('Please enter a description', 'Error');
        }

        try {
            await api.updateDescription(description);
            await message('Description updated successfully! Changes will take effect on the next server restart.', 'Success');
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to update description');
            await fatal(msg, 'Error');
        }
    });
}

function setupServerMgmt() {
    const api = ApiClient.getInstance();
    const [restartBtn] = cf.select({ s: '#restart-server-btn' });

    restartBtn.addEventListener('click', async () => {
        if (!await confirm(
            'Are you sure you want to restart the server? This will make the site temporarily unavailable.',
            {
                yes: "Restart",
                no: "Cancel"
            },
            "Confirmation"
        )) {
            return;
        }

        const t = await input("Please type the word 'restart' to confirm.");
        if (t !== 'restart') return await message('Cancelled.');

        try {
            await api.restartServer();
            await message('Server restart initiated. The page will reload in 5 seconds.', 'Success');
            setTimeout(() => location.reload(), 5000);
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to restart server');
            await fatal(msg, 'Error');
        }
    });
}

function setupModerationLog() {
    const api = ApiClient.getInstance();
    const logsStore = cf.store({ type: 'list', value: [] });
    const pagination = cf.store({ value: { page: 1, total: 1 } });
    const LOG_PAGE_SIZE = 20;

    const loadModerationLogs = async (page = 1) => {
        try {
            const result = await api.getModerationLog(page, LOG_PAGE_SIZE);
            logsStore.update(result.data.logs);
            pagination.update({
                page: result.data.page,
                total: result.data.total
            });
        } catch (error) {
            const { msg } = api.handleApiError(error, 'Failed to load moderation log');
            await message(msg, 'Error');
        }
    };

    const handlePageChange = (newPage) => {
        loadModerationLogs(newPage);
    };

    const [logList] = ModerationLogList(
        logsStore,
        pagination,
        handlePageChange
    );

    const [contentWrapper] = cf.select({ s: '#moderation-log' });

    if (contentWrapper) {
        cf.insert(logList, { into: contentWrapper });
    }

    const [refreshBtn] = cf.select({ s: '#mod-log-refresh' });
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const page = pagination.current().page;
            await loadModerationLogs(page);
            await message('Fetched latest moderation actions.', 'Success');
        });
    }

    loadModerationLogs(1);
}

globalThis.addEventListener('DOMContentLoaded', async () => {
    await setupLogin();
    setupPostMgmt();
    setupCommentMgmt();
    setupSignupCodeMgmt();
    setupDescriptionMgmt();
    setupServerMgmt();
    setupEditionMgmt();
    setupModerationLog();
});
