
import { CreditCard } from "lucide-react";

export default function PlatformBilling() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Financeiro & Assinaturas</h1>
                <p className="text-gray-400">Gestão de faturamento SaaS e planos.</p>
            </div>

            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center justify-center">
                <CreditCard className="w-12 h-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">Módulo em Desenvolvimento</h3>
                <p>Gestão de faturas, inadimplência e planos será vista aqui.</p>
            </div>
        </div>
    );
}
