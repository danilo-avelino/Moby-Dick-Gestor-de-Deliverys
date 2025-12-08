import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OperationMode = 'single' | 'separate';

export interface Shift {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
}

export interface SubRestaurant {
    id: string;
    name: string;
    cuisineType: string;
    shifts: Shift[];
    integrations: {
        logistics: string[];
        sales: string[];
    };
}

interface SettingsState {
    operationMode: OperationMode;
    subRestaurants: SubRestaurant[];
    setOperationMode: (mode: OperationMode) => void;
    addSubRestaurant: (restaurant: Omit<SubRestaurant, 'id'>) => void;
    updateSubRestaurant: (id: string, data: Partial<SubRestaurant>) => void;
    deleteSubRestaurant: (id: string) => void;
    updateIntegrations: (restaurantId: string, type: 'logistics' | 'sales', integrations: string[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            operationMode: 'single',
            subRestaurants: [],

            setOperationMode: (mode) => set({ operationMode: mode }),

            addSubRestaurant: (restaurant) => {
                const id = `rest_${Date.now()}`;
                set((state) => ({
                    subRestaurants: [...state.subRestaurants, { ...restaurant, id }],
                }));
            },

            updateSubRestaurant: (id, data) => {
                set((state) => ({
                    subRestaurants: state.subRestaurants.map((r) =>
                        r.id === id ? { ...r, ...data } : r
                    ),
                }));
            },

            deleteSubRestaurant: (id) => {
                set((state) => ({
                    subRestaurants: state.subRestaurants.filter((r) => r.id !== id),
                }));
            },

            updateIntegrations: (restaurantId, type, integrations) => {
                set((state) => ({
                    subRestaurants: state.subRestaurants.map((r) =>
                        r.id === restaurantId
                            ? { ...r, integrations: { ...r.integrations, [type]: integrations } }
                            : r
                    ),
                }));
            },
        }),
        {
            name: 'settings-storage',
        }
    )
);

// Available integrations
export const LOGISTICS_INTEGRATIONS = [
    { id: 'foody', name: 'Foody', logo: '🚚' },
    { id: 'agilizone', name: 'Agilizone', logo: '⚡' },
    { id: 'saipos', name: 'Saipos', logo: '📦' },
];

export const SALES_INTEGRATIONS = [
    { id: 'ifood', name: 'iFood', logo: '🍔' },
    { id: '99food', name: '99Food', logo: '🛵' },
    { id: 'neemo', name: 'Neemo', logo: '🍕' },
    { id: 'cardapio_web', name: 'Cardápio Web', logo: '📱' },
    { id: 'anotaai', name: 'AnotaAi', logo: '📝' },
    { id: 'saipos_vendas', name: 'Saipos', logo: '💳' },
    { id: 'consumer', name: 'Consumer', logo: '🛒' },
];

export const CUISINE_TYPES = [
    'Brasileira',
    'Hambúrguer',
    'Pizza',
    'Japonesa',
    'Italiana',
    'Mexicana',
    'Árabe',
    'Chinesa',
    'Açaí e Sorvetes',
    'Doces e Sobremesas',
    'Saudável',
    'Marmitas',
    'Outro',
];

// Predefined shift patterns for standardized analysis
export const SHIFT_PRESETS = [
    { id: 'manha', name: 'Manhã', startTime: '06:00', endTime: '12:00', icon: '🌅' },
    { id: 'tarde', name: 'Tarde', startTime: '12:00', endTime: '18:00', icon: '☀️' },
    { id: 'noite', name: 'Noite', startTime: '18:00', endTime: '00:00', icon: '🌙' },
    { id: 'madrugada', name: 'Madrugada', startTime: '00:00', endTime: '06:00', icon: '🌃' },
    { id: 'almoco', name: 'Almoço', startTime: '11:00', endTime: '15:00', icon: '🍽️' },
    { id: 'jantar', name: 'Jantar', startTime: '18:00', endTime: '23:00', icon: '🍷' },
    { id: 'happy_hour', name: 'Happy Hour', startTime: '17:00', endTime: '20:00', icon: '🍻' },
];

export type ShiftPresetId = typeof SHIFT_PRESETS[number]['id'];
