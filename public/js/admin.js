import { ApiClient } from './api-client.js';
import { message, fatal } from 'https://esm.sh/cf-alert@0.4.1';
import * as cf from "https://esm.sh/jsr/@campfire/core@4.0.2";

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
            const apiClient = ApiClient.getInstance();
            try {
                await apiClient.logout();
                await message('Logged out successfully', 'Success');
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                console.error('Logout error:', error);
                apiClient.clearToken();
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

globalThis.addEventListener('DOMContentLoaded', async () => {
    const form = document.querySelector('#login-form');
    const apiClient = ApiClient.getInstance();

    const isAuthenticated = await apiClient.validateAuth();
    if (isAuthenticated) {
        const { success, user } = await apiClient.whoami();
        if (success && user) {
            const [summary] = cf.select({ s: 'details:has(#login-form)>summary' });
            const [userInfo] = UserInfo(user.username);

            summary.innerHTML = '';
            cf.insert(userInfo, { into: summary });
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = getFormJson(form);

        if (!data.username?.trim() || !data.password) {
            await message('Please enter both username and password', 'Error');
            return;
        }

        try {
            const isSignup = data.signupCode && data.signupCode.trim() !== "";
            await apiClient.authenticate(data, isSignup);
            await message('Authentication successful!', 'Success');
            // Reload the page to show the authenticated state
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            const { msg } = apiClient.handleApiError(error, 'Authentication failed');
            await fatal(msg, 'Error');
        }
    });
});
