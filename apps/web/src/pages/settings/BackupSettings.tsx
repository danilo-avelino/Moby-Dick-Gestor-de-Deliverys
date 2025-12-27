import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, Upload, Loader2, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

export function BackupSettings() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importData, setImportData] = useState<any>(null);

    const exportMutation = useMutation({
        mutationFn: async () => {
            const response = await api.get('/api/backup/export');
            return response.data;
        },
        onSuccess: (data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `moby-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Backup exportado com sucesso!');
        },
        onError: () => toast.error('Erro ao exportar backup')
    });

    const importMutation = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/api/backup/import', { data: data.data, metadata: data.metadata });
        },
        onSuccess: () => {
            toast.success('Backup restaurado com sucesso!');
            setImportData(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: () => toast.error('Erro ao restaurar backup')
    });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (!json.data || !json.metadata) {
                    toast.error('Formato de arquivo inválido');
                    return;
                }
                setImportData(json);
                toast.success('Arquivo carregado com sucesso! Verifique os dados abaixo.');
            } catch (err) {
                toast.error('Erro ao ler arquivo');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-white">Backup & Dados</h1>
                <p className="text-gray-400">Gerencie o backup e restauração dos dados da sua organização</p>
            </div>

            {/* Export Section */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary-400" /> Exportar Dados
                </h3>
                <p className="text-gray-300 mb-6">
                    Faça o download de todos os dados da sua organização, incluindo produtos, receitas, estoque e configurações.
                    O arquivo gerado pode ser usado para restaurar seus dados posteriormente.
                </p>
                <button
                    onClick={() => exportMutation.mutate()}
                    disabled={exportMutation.isPending}
                    className="btn-primary flex items-center gap-2"
                >
                    {exportMutation.isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Exportando...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Baixar Backup
                        </>
                    )}
                </button>
            </div>

            {/* Import Section */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary-400" /> Importar Dados
                </h3>

                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-yellow-400 font-medium mb-1">Atenção ao restaurar dados</h4>
                            <p className="text-sm text-gray-300">
                                A importação irá atualizar registros existentes (se o ID corresponder) e criar novos registros.
                                Certifique-se de que o arquivo de backup é confiável e recente.
                            </p>
                        </div>
                    </div>
                </div>

                {!importData ? (
                    <div className="border-2 border-dashed border-gray-700 hover:border-primary-500/50 rounded-xl p-8 transition-colors text-center">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="hidden"
                            id="backup-upload"
                        />
                        <label htmlFor="backup-upload" className="cursor-pointer flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                                <Upload className="w-6 h-6 text-gray-400" />
                            </div>
                            <span className="font-medium text-white">Clique para selecionar o arquivo de backup</span>
                            <span className="text-sm text-gray-500">Formato .json</span>
                        </label>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-3 mb-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                <h4 className="text-green-400 font-medium">Arquivo pronto para importação</h4>
                            </div>
                            <div className="text-sm text-gray-300 grid grid-cols-2 gap-2 mt-2 ml-8">
                                <p>Versão: <span className="text-white">{importData.metadata.version}</span></p>
                                <p>Data: <span className="text-white">{new Date(importData.metadata.exportedAt).toLocaleDateString()}</span></p>
                                <p>Produtos: <span className="text-white">{importData.metadata.counts.products}</span></p>
                                <p>Receitas: <span className="text-white">{importData.metadata.counts.recipes}</span></p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setImportData(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="btn-ghost flex-1"
                                disabled={importMutation.isPending}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => importMutation.mutate(importData)}
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                                disabled={importMutation.isPending}
                            >
                                {importMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Restaurando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Confirmar Restauração
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
