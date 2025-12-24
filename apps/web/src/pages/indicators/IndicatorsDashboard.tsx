import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { UserRole } from "types"; // Adjust import
import { Target, TrendingUp, AlertCircle, Info, Settings } from "lucide-react";
import { IndicatorCard } from "./components/IndicatorCard"; // Will create next
import { IndicatorModal } from "./components/IndicatorModal"; // Will create next
import { IndicatorConfigModal } from "./components/IndicatorConfigModal"; // Will create next
import { IndicatorListConfigModal } from "./components/IndicatorListConfigModal";

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

    // Filter active indicators for display
    const activeIndicators = indicators?.filter((ind: any) => ind.isActive !== false) || [];

    return (
        <div className="p-8 space-y-8 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Indicadores</h1>
                    <p className="text-gray-400 mt-1">Acompanhe o desempenho da sua operação em tempo real.</p>
                </div>

                {canConfigure && (
                    <button
                        onClick={() => setIsConfigOpen(true)}
                        className="flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors shadow-sm"
                    >
                        <Settings className="w-5 h-5 text-gray-400 group-hover:text-white" />
                        <span>Configurar Acompanhamento</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {activeIndicators.map((indicator: any) => (
                    <IndicatorCard
                        key={indicator.id}
                        indicator={indicator}
                        onClick={() => setSelectedIndicatorId(indicator.id)}
                    />
                ))}

                {activeIndicators.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
                        <Target className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Nenhum indicador ativo.</p>
                        {canConfigure && (
                            <button
                                onClick={() => setIsConfigOpen(true)}
                                className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                            >
                                Configurar indicadores
                            </button>
                        )}
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

            {isConfigOpen && (
                <IndicatorListConfigModal
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    indicators={indicators || []}
                />
            )}
        </div>
    );
}
