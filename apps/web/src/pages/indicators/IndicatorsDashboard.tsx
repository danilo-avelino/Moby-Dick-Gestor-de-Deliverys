import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { UserRole } from "types"; // Adjust import
import { Target, TrendingUp, AlertCircle, Info, Settings } from "lucide-react";
import { IndicatorCard } from "./components/IndicatorCard"; // Will create next
import { IndicatorModal } from "./components/IndicatorModal"; // Will create next
import { IndicatorConfigModal } from "./components/IndicatorConfigModal"; // Will create next

export default function IndicatorsDashboard() {
    const { user } = useAuthStore();
    const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const { data: indicators, isLoading } = useQuery({
        queryKey: ["indicators"],
        queryFn: () => api.get("/api/indicators").then((res) => res.data),
    });

    const canConfigure =
        user?.role === UserRole.DIRETOR ||
        user?.role === UserRole.MANAGER ||
        user?.role === UserRole.ADMIN ||
        user?.role === UserRole.SUPER_ADMIN;

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Indicadores</h1>
                    <p className="text-gray-500 mt-1">Acompanhe o desempenho da sua operação em tempo real.</p>
                </div>

                {/* Only Managers can filter/configure "watched" indicators? Or general config?
            Requirement: "Implementar botão Acompanhar Indicadores". 
            "Apenas Gestor e Diretor podem selecionar indicadores acompanhados." 
        */}
                {canConfigure && (
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="flex items-center space-x-2 bg-white border border-gray-300 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <Settings className="w-5 h-5 text-gray-500" />
                        <span>Configurar Acompanhamento</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {indicators?.map((indicator: any) => (
                    <IndicatorCard
                        key={indicator.id}
                        indicator={indicator}
                        onClick={() => setSelectedIndicatorId(indicator.id)}
                    />
                ))}

                {indicators?.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400">
                        <Target className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Nenhum indicador disponível.</p>
                        <p className="text-sm">Peça ao administrador para configurar os indicadores do sistema.</p>
                    </div>
                )}
            </div>

            {selectedIndicatorId && (
                <IndicatorModal
                    isOpen={!!selectedIndicatorId}
                    onClose={() => setSelectedIndicatorId(null)}
                    indicatorId={selectedIndicatorId}
                />
            )}

            {/* Configuration Modal (Global or Per Indicator? Prompt says "Persistir seleção de indicadores por organização".
          "Acompanhar Indicadores" implies a selection list.
          But also "Configurar metas" is per indicator.
          Let's assume this button opens a list to toggle "Watching" or visibility? 
          Actually, the API filters for Staff. For Manager, they see ALL?
          If Manager sees all, maybe this configures which ones represent "Key" indicators or general visibility/targets.
          Let's verify requirement 1.3: "Persistir seleção de indicadores por organização".
      */}
            {/* We can implement a bulk config or simple list toggle later. For now, let's focus on the visualization. */}
        </div>
    );
}
