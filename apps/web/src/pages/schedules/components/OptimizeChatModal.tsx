import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import { api } from '../../../lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface OptimizeChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    sectorId: string;
    onApplyChanges: (operations: any) => void; // Callback when AI returns operations
}

export function OptimizeChatModal({ isOpen, onClose, sectorId, onApplyChanges }: OptimizeChatModalProps) {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Olá! Sou seu assistente de escala. Como posso ajudar a ajustar os horários hoje? Ex: "Coloque a Maria de folga no domingo".' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Placeholder: In a real implementation this calls the AI endpoint
            // const res = await api.post('/api/schedules/optimize-chat', { prompt: input, sectorId });
            // For now, mock response
            setTimeout(() => {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Entendido. Vou processar sua solicitação. (Simulação: Backend AI processaria e retornaria operações para atualizar a matriz).'
                };
                setMessages(prev => [...prev, aiMsg]);
                setIsLoading(false);
                // Trigger hypothetical updates here if we had the backend ready
                // onApplyChanges(res.data.operations);
            }, 1000);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Desculpe, ocorreu um erro ao processar seu pedido.' }]);
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center sm:items-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-md h-[500px] flex flex-col shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary-500/20 p-2 rounded-lg">
                            <Bot className="text-primary-400 w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-white">Assistente de Escala</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                    ? 'bg-primary-600 text-white rounded-br-none'
                                    : 'bg-slate-800 text-gray-200 rounded-bl-none border border-white/5'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 rounded-lg p-3 border border-white/5 flex gap-1 items-center">
                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-white/10 bg-slate-800/30">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
                            placeholder="Digite sua solicitação..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="bg-primary-600 hover:bg-primary-500 text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
