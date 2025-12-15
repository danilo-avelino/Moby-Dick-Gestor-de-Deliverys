import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { UserDTO, LoginResponse } from 'types';

interface AuthState {
    user: UserDTO | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: { email: string; password: string; firstName: string; lastName: string; restaurantName: string }) => Promise<void>;
    logout: () => void;
    refreshAccessToken: () => Promise<void>;
    setUser: (user: UserDTO) => void;
    switchRestaurant: (restaurantId: string) => Promise<void>;
    originalSession: { accessToken: string; user: UserDTO } | null;
    startImpersonation: (newUser: UserDTO, newAccessToken: string) => void;
    stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            originalSession: null,

            startImpersonation: (newUser: UserDTO, newAccessToken: string) => {
                const { user, accessToken } = get();
                if (!user || !accessToken) return;

                set({
                    originalSession: { user, accessToken },
                    user: newUser,
                    accessToken: newAccessToken
                });
                api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
            },

            stopImpersonation: () => {
                const { originalSession } = get();
                if (originalSession) {
                    set({
                        user: originalSession.user,
                        accessToken: originalSession.accessToken,
                        originalSession: null
                    });
                    api.defaults.headers.common['Authorization'] = `Bearer ${originalSession.accessToken}`;
                }
            },

            login: async (email: string, password: string) => {
                set({ isLoading: true });
                try {
                    const response = await api.post('/api/auth/login', { email, password });
                    const { user, accessToken, refreshToken } = response.data.data as LoginResponse;
                    set({
                        user,
                        accessToken,
                        refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                        originalSession: null, // Clear any stale session
                    });
                    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                } catch (error: any) {
                    set({ isLoading: false });
                    throw new Error(error.response?.data?.error?.message || 'Login failed');
                }
            },

            // ... (keep register implementation same as before if not shown, but I need to make sure I don't break it. 
            // Since I am replacing login block, I should be careful. 
            // Actually, I can just insert the new methods before login, and update valid partialize in the end.

            register: async (data) => {
                set({ isLoading: true });
                try {
                    const response = await api.post('/api/auth/register', data);
                    const { user, accessToken, refreshToken } = response.data.data as LoginResponse;
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
                    originalSession: null,
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

            setUser: (user: UserDTO) => set({ user }),

            switchRestaurant: async (restaurantId: string) => {
                set({ isLoading: true });
                try {
                    const response = await api.post('/api/auth/switch-restaurant', { restaurantId });
                    const { user, accessToken } = response.data.data;

                    // Update user and token
                    set((state) => ({
                        user: { ...state.user, ...user }, // Merge to update fields like restaurantId and restaurant details
                        accessToken,
                        isLoading: false
                    }));

                    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

                    // Optional: force reload logic if deeply nested components rely on stale data
                } catch (error: any) {
                    set({ isLoading: false });
                    throw new Error(error.response?.data?.error?.message || 'Failed to switch restaurant');
                }
            }
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
                originalSession: state.originalSession,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.accessToken) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
                }
            },
        }
    )
);
