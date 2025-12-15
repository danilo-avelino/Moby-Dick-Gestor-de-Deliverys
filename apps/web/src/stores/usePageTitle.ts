import { create } from 'zustand';

interface PageTitleState {
    title: string;
    setTitle: (title: string) => void;
}

export const usePageTitle = create<PageTitleState>((set) => ({
    title: 'Moby Dick',
    setTitle: (title) => set({ title }),
}));
