import { create } from 'zustand';
import { api } from '../lib/api';
import { getYear, getMonth } from 'date-fns';

interface ScheduleState {
    year: number;
    month: number;
    sectors: any[];
    selectedSectorId: string | null;

    // Config
    monthConfig: any | null;

    // Simulation/Draft Data
    matrix: Record<string, Record<number, string>>;
    stats: {
        coverageByDay: Record<number, number>;
        warnings: string[];
        score: number;
    } | null;

    isLoading: boolean;
    isSimulating: boolean;
    error: string | null;
    setError: (msg: string | null) => void;

    // Actions
    setMonth: (year: number, month: number) => void;
    fetchSectors: () => Promise<void>;
    selectSector: (sectorId: string) => void;
    fetchMonthConfig: () => Promise<void>;

    simulate: () => Promise<void>;
    optimize: () => Promise<void>;
    finalize: () => Promise<any>;

    deleteSchedule: () => Promise<void>;
    updateCell: (userId: string, day: number, value: string) => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
    year: getYear(new Date()),
    month: getMonth(new Date()) + 1, // date-fns getMonth is 0-11
    sectors: [],
    selectedSectorId: null,
    monthConfig: null,
    matrix: {},
    stats: null,
    isLoading: false,
    isSimulating: false,

    setMonth: (year, month) => {
        set({ year, month });
        get().fetchMonthConfig();
    },

    fetchSectors: async () => {
        set({ isLoading: true });
        try {
            const res = await api.get('/api/schedules/sectors');
            set({ sectors: res.data });
            if (res.data.length > 0 && !get().selectedSectorId) {
                set({ selectedSectorId: res.data[0].id });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    selectSector: (sectorId) => set({ selectedSectorId: sectorId, matrix: {}, stats: null }),

    fetchMonthConfig: async () => {
        const { year, month } = get();
        try {
            const res = await api.get('/api/schedules/month-config', { params: { year, month } });
            set({ monthConfig: res.data });
        } catch (err) {
            console.error(err);
        }
    },

    error: null,
    setError: (msg) => set({ error: msg }),

    simulate: async () => {
        const { year, month, selectedSectorId } = get();
        if (!selectedSectorId) return;

        set({ isSimulating: true, error: null });
        try {
            const res = await api.post('/api/schedules/simulate', {
                year,
                month,
                sectorId: selectedSectorId
            });
            set({
                matrix: res.data.matrix,
                stats: {
                    coverageByDay: res.data.coverageByDay,
                    warnings: res.data.warnings,
                    score: res.data.score
                },
                error: null
            });
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.error || 'Erro ao gerar escala. Verifique se há funcionários cadastrados.';
            set({ error: msg, matrix: {}, stats: null });
        } finally {
            set({ isSimulating: false });
        }
    },

    optimize: async () => {
        const { year, month, selectedSectorId, matrix } = get();
        if (!selectedSectorId) return;

        set({ isSimulating: true });
        try {
            const res = await api.post('/api/schedules/optimize', {
                year,
                month,
                sectorId: selectedSectorId,
                currentMatrix: matrix
            });
            set({
                matrix: res.data.matrix,
                stats: {
                    coverageByDay: res.data.coverageByDay,
                    warnings: res.data.warnings,
                    score: res.data.score
                }
            });
        } finally {
            set({ isSimulating: false });
        }
    },

    finalize: async () => {
        const { year, month, selectedSectorId, matrix, stats } = get();
        if (!selectedSectorId || !stats) return;

        set({ isLoading: true });
        try {
            const res = await api.post('/api/schedules/finalize', {
                year,
                month,
                sectorId: selectedSectorId,
                matrix,
                stats
            });
            // alert('Escala Finalizada com Sucesso! (Mock)');
            return res.data;
        } finally {
            set({ isLoading: false });
        }
    },

    deleteSchedule: async () => {
        const { year, month, selectedSectorId } = get();
        if (!selectedSectorId) return;

        if (!confirm('Tem certeza que deseja excluir a escala deste setor para este mês?')) return;

        set({ isLoading: true });
        try {
            await api.delete('/api/schedules', {
                params: { year, month, sectorId: selectedSectorId }
            });
            set({ matrix: {}, stats: null });
        } catch (err) {
            console.error(err);
            alert('Erro ao excluir escala');
        } finally {
            set({ isLoading: false });
        }
    },

    updateCell: (userId, day, value) => {
        const { matrix } = get();
        const newMatrix = { ...matrix };

        if (!newMatrix[userId]) newMatrix[userId] = {};
        newMatrix[userId][day] = value;

        set({ matrix: newMatrix });
    }
}));
