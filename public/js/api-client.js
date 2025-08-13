export class ApiClient {
    static instance = null;

    static getInstance() {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    constructor(baseURL = '') {
        if (ApiClient.instance) {
            return ApiClient.instance;
        }

        this.baseURL = baseURL;
        this.loadToken();

        addEventListener('storage', (e) => {
            if (e.key === 'adminToken') {
                this.loadToken();
            }
        });

        ApiClient.instance = this;
    }

    loadToken() {
        this.token = localStorage.getItem('adminToken');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        this.loadToken();

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
                ...(options.headers || {})
            },
            ...options
        });

        // Handle redirects
        if (response.redirected) {
            return { redirected: true, url: response.url };
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
            const error = new Error(result.error.details);
            error.details = {
                status: response.status,
                error: result.error
            }
            throw error;
        }

        return result;
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('adminToken', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('adminToken');
    }

    async isAuthenticated() {
        if (!this.token) return false;

        try {
            const result = await this.whoami();
            return result.success;
        } catch {
            this.clearToken();
            return false;
        }
    }

    async getEditions() {
        return await this.request('/api/v1/editions');
    }

    async getPost(postId) {
        return await this.request(`/api/v1/post/${postId}`);
    }

    async getComment(commentId) {
        return await this.request(`/api/v1/admin/comments/${commentId}`);
    }

    async resetPostEditCode(postId) {
        return await this.request(`/api/admin/v1/post/${postId}/reset-edit-code`, {
            method: 'POST'
        });
    }

    async adminSignup(signupData) {
        const result = await this.request('/api/v1/admin/signup', {
            method: 'POST',
            body: JSON.stringify(signupData)
        });
        if (result.success && result.token) {
            this.setToken(result.token);
        }
        return result;
    }

    async adminLogin(credentials) {
        const result = await this.request('/api/v1/admin/signin', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        if (result.success && result.token) {
            this.setToken(result.token);
        }
        return result;
    }

    async createSignupCode(codeData) {
        return await this.request('/api/v1/admin/codes', {
            method: 'POST',
            body: JSON.stringify(codeData || {})
        });
    }

    async deletePost(postId) {
        return await this.request(`/api/v1/admin/posts/${postId}`, {
            method: 'DELETE'
        });
    }

    async setPostNsfw(postId, nsfw) {
        return await this.request(`/api/v1/admin/posts/${postId}/nsfw`, {
            method: 'PATCH',
            body: JSON.stringify({ nsfw })
        });
    }

    async deleteComment(commentId) {
        return await this.request(`/api/v1/admin/comments/${commentId}`, {
            method: 'DELETE'
        });
    }

    async createEdition(editionData) {
        // Server expects { name: string } in the body
        const data = typeof editionData === 'string' ? { name: editionData } : editionData;
        return await this.request('/api/v1/admin/editions', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Get current user information
    async whoami() {
        try {
            const result = await this.request('/api/v1/admin/whoami');
            return result;
        } catch (error) {
            if (error?.details?.status === 401 || error?.details?.status === 403) this.clearToken();
            throw error;
        }
    }

    handleApiError(error, defaultMessage = 'An error occurred') {
        console.error('API Error:', error);

        let { status, error: data } = error;
        if (error instanceof Error && error.details) {
            ({ status, data } = error.details);
        }

        if (data.details) {
            if (status === 401) return this.clearToken();
            return {
                msg: `${data.code || 'Error'}: ${data.details}`
            }
        }

        switch (status) {
            case 400:
                return { msg: 'Invalid request. Please check your input and try again.' };
            case 401:
                this.clearToken();
                return { msg: "Invalid session. Please re-authenticate." };
            case 403:
                return { msg: 'You do not have permission to perform this action.' };
            case 404:
                return { msg: 'Resource not found.' };
            case 409:
                return { msg: 'A conflict occurred. Please try again.' };
            case 429:
                return { msg: 'Too many requests. Please wait a moment before trying again.' };
            case 500:
                return { msg: 'An internal server error occurred. Please try again later.' };
        }

        return { msg: defaultMessage };
    }

    // Utility method to validate and refresh authentication state
    async validateAuth() {
        if (!this.token) return false;

        try {
            const result = await this.whoami();
            return result.success;
        } catch {
            this.clearToken();
            return false;
        }
    }

    async authenticate(credentials, signup = false) {
        const method = signup ? 'adminSignup' : 'adminLogin';
        const result = await this[method](credentials);

        if (!result.success) {
            throw result.error;
        }

        return result;
    }

    logout() {
        this.clearToken();
    }
}
