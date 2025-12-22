import axios from 'axios';

const getBaseUrl = () => {
    // In development mode, we want to use the Vite proxy to handle CORS and path rewriting.
    // The proxy is configured to forward /api requests to the backend.
    if (import.meta.env.DEV) {
        return '';
    }

    const configuredUrl = import.meta.env.VITE_API_URL || '';

    // If configured URL is localhost but we are on a different host (LAN),
    // we should use relative path to let the proxy handle it.
    if (configuredUrl.includes('localhost') &&
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1') {
        return '';
    }

    return configuredUrl;
};

export const api = axios.create({
    baseURL: getBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/login')) {
            originalRequest._retry = true;

            try {
                // Try to refresh token
                const { useAuthStore } = await import('../stores/auth');
                await useAuthStore.getState().refreshAccessToken();

                // Retry original request
                const token = useAuthStore.getState().accessToken;
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                return api(originalRequest);
            } catch {
                // Refresh failed, logout
                const { useAuthStore } = await import('../stores/auth');
                useAuthStore.getState().logout();
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
