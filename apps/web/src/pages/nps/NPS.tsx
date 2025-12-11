import { MessageSquare } from 'lucide-react';

export default function NPS() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-8 h-8 text-primary-500" />
                    NPS
                </h1>
                <p className="text-gray-400">Net Promoter Score</p>
            </div>

            <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Em Desenvolvimento</h2>
                <p className="text-gray-400 max-w-md">
                    O módulo de NPS está sendo desenvolvido e estará disponível em breve.
                </p>
            </div>
        </div>
    );
}
