import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    restaurantId?: string;
    restaurant?: {
        id: string;
        name: string;
        logoUrl?: string;
        settings: {
            primaryColor: string;
            secondaryColor: string;
        };
    };
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { email: string; password: string; firstName: string; lastName: string; restaurantName: string }) => Promise<void>;
    logout: () => void;
    refreshAccessToken: () => Promise<void>;
    setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,

            login: async (email: string, password: string) => {
                set({ isLoading: true });
                try {
                    const response = await api.post('/api/auth/login', { email, password });
                    const { user, accessToken, refreshToken } = response.data.data;
                    set({
                        user,
                        accessToken,
                        refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                } catch (error: any) {
                    set({ isLoading: false });
                    throw new Error(error.response?.data?.error?.message || 'Login failed');
                }
            },

            register: async (data) => {
                set({ isLoading: true });
                try {
                    const response = await api.post('/api/auth/register', data);
                    const { user, accessToken, refreshToken } = response.data.data;
                    set({
                        user,
                        accessToken,
                        refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                } catch (error: any) {
                    set({ isLoading: false });
                    throw new Error(error.response?.data?.error?.message || 'Registration failed');
                }
            },

            logout: () => {
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                });
                delete api.defaults.headers.common['Authorization'];
            },

            refreshAccessToken: async () => {
                const { refreshToken } = get();
                if (!refreshToken) {
                    get().logout();
                    return;
                }
                try {
                    const response = await api.post('/api/auth/refresh', { refreshToken });
                    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
                    set({
                        accessToken: newAccessToken,
                        refreshToken: newRefreshToken,
                    });
                    api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                } catch {
                    get().logout();
                }
            },

            setUser: (user: User) => set({ user }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.accessToken) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
                }
            },
        }
    )
);
