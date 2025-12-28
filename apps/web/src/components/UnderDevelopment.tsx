
import { Divide, LucideIcon, MessageSquare, Construction } from 'lucide-react';
import React from 'react';

interface UnderDevelopmentProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
}

export default function UnderDevelopment({
    title,
    description = "Este módulo está sendo desenvolvido e estará disponível em breve.",
    icon: Icon = Construction
}: UnderDevelopmentProps) {
    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Icon className="w-8 h-8 text-primary-500" />
                    {title}
                </h1>
            </div>

            <div className="glass-card flex-1 flex flex-col items-center justify-center py-20 text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Em Desenvolvimento</h2>
                <p className="text-gray-400 max-w-md">
                    {description}
                </p>
            </div>
        </div>
    );
}
