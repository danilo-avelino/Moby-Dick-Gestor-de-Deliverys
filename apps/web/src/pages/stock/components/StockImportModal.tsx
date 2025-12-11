import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';

interface StockImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ImportError {
    row: number;
    field: string;
    value: string;
    message: string;
}

interface ImportResult {
    totalRows: number;
    importedRows: number;
    createdProducts: number;
    updatedProducts: number;
    createdCategories: number;
    errors: ImportError[];
    message: string;
}

export default function StockImportModal({ isOpen, onClose }: StockImportModalProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [sobrescreverEstoque, setSobrescreverEstoque] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const importMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sobrescreverEstoqueAtual', sobrescreverEstoque.toString());

            const response = await api.post('/api/stock/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        },
        onSuccess: (data) => {
            if (data.success) {
                setImportResult(data.data);
                toast.success(data.data.message);
                queryClient.invalidateQueries({ queryKey: ['stock'] });
                queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
                queryClient.invalidateQueries({ queryKey: ['products'] });
                queryClient.invalidateQueries({ queryKey: ['categories'] });
                queryClient.invalidateQueries({ queryKey: ['product-details'] });
            } else {
                toast.error(data.error?.message || 'Erro na importação');
            }
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error?.message || 'Erro ao importar arquivo');
        },
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                toast.error('Selecione um arquivo Excel (.xlsx ou .xls)');
                return;
            }
            setSelectedFile(file);
            setImportResult(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                toast.error('Selecione um arquivo Excel (.xlsx ou .xls)');
                return;
            }
            setSelectedFile(file);
            setImportResult(null);
        }
    };

    const handleImport = () => {
        if (selectedFile) {
            importMutation.mutate(selectedFile);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setImportResult(null);
        setSobrescreverEstoque(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto bg-gray-900 rounded-2xl border border-white/10 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-500/20">
                            <FileSpreadsheet className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">Importar Estoque</h2>
                            <p className="text-sm text-gray-400">Importe seu estoque a partir de um arquivo Excel</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Upload Area */}
                    {!importResult && (
                        <>
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                    ${selectedFile
                                        ? 'border-primary-500/50 bg-primary-500/5'
                                        : 'border-white/20 hover:border-primary-500/50 hover:bg-white/5'
                                    }
                                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                {selectedFile ? (
                                    <div className="space-y-2">
                                        <FileSpreadsheet className="w-12 h-12 mx-auto text-primary-400" />
                                        <p className="text-white font-medium">{selectedFile.name}</p>
                                        <p className="text-gray-400 text-sm">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFile(null);
                                            }}
                                            className="text-sm text-red-400 hover:text-red-300"
                                        >
                                            Remover arquivo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-12 h-12 mx-auto text-gray-500" />
                                        <p className="text-white">Arraste o arquivo aqui ou clique para selecionar</p>
                                        <p className="text-gray-400 text-sm">Arquivos Excel (.xlsx ou .xls)</p>
                                    </div>
                                )}
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={sobrescreverEstoque}
                                        onChange={(e) => setSobrescreverEstoque(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 text-primary-500 focus:ring-primary-500"
                                    />
                                    <div>
                                        <p className="text-white font-medium">Sobrescrever estoque completo</p>
                                        <p className="text-gray-400 text-sm">
                                            Produtos que não estiverem na planilha terão o estoque zerado
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {/* Template Info */}
                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <h4 className="text-blue-400 font-medium mb-2">Formato esperado da planilha:</h4>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    <li>• Aba com nome: <code className="text-primary-400">"Posição de estoque"</code></li>
                                    <li>• Colunas: Data, Ingrediente, Grupo ingrediente, Estoque Atual, Qtde Conferida, Diferença, Valor unitário, Total</li>
                                    <li>• Estoque Atual no formato: <code className="text-primary-400">"2,3600KG"</code> (quantidade + unidade)</li>
                                    <li>• Data no formato: <code className="text-primary-400">"dd/MM/yyyy"</code></li>
                                </ul>
                            </div>
                        </>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className={`p-4 rounded-lg ${importResult.errors.length === 0
                                ? 'bg-green-500/10 border border-green-500/20'
                                : 'bg-yellow-500/10 border border-yellow-500/20'
                                }`}>
                                <div className="flex items-center gap-3 mb-3">
                                    {importResult.errors.length === 0 ? (
                                        <CheckCircle className="w-6 h-6 text-green-400" />
                                    ) : (
                                        <AlertCircle className="w-6 h-6 text-yellow-400" />
                                    )}
                                    <h3 className="text-lg font-medium text-white">
                                        {importResult.errors.length === 0 ? 'Importação concluída!' : 'Importação concluída com alertas'}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <p className="text-2xl font-bold text-white">{importResult.importedRows}</p>
                                        <p className="text-sm text-gray-400">Linhas importadas</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <p className="text-2xl font-bold text-green-400">{importResult.createdProducts}</p>
                                        <p className="text-sm text-gray-400">Produtos criados</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <p className="text-2xl font-bold text-blue-400">{importResult.updatedProducts}</p>
                                        <p className="text-sm text-gray-400">Produtos atualizados</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5">
                                        <p className="text-2xl font-bold text-purple-400">{importResult.createdCategories}</p>
                                        <p className="text-sm text-gray-400">Categorias criadas</p>
                                    </div>
                                </div>
                            </div>

                            {/* Errors */}
                            {importResult.errors.length > 0 && (
                                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <h4 className="text-red-400 font-medium mb-3">
                                        {importResult.errors.length} erro(s) encontrado(s):
                                    </h4>
                                    <div className="max-h-40 overflow-y-auto space-y-2">
                                        {importResult.errors.map((error, index) => (
                                            <div key={index} className="text-sm p-2 rounded bg-white/5">
                                                <span className="text-gray-400">Linha {error.row}:</span>{' '}
                                                <span className="text-red-400">{error.message}</span>
                                                {error.value && (
                                                    <span className="text-gray-500"> ({error.field}: "{error.value}")</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors"
                    >
                        {importResult ? 'Fechar' : 'Cancelar'}
                    </button>
                    {!importResult && (
                        <button
                            onClick={handleImport}
                            disabled={!selectedFile || importMutation.isPending}
                            className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {importMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Importar Estoque
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
