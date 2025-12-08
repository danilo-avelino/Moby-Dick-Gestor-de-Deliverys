import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatPercent, formatCurrency } from '../../lib/utils';
import { Star, DollarSign, TrendingUp, TrendingDown, HelpCircle, Skull } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const classificationColors = {
    STAR: '#22c55e',
    CASH_COW: '#3b82f6',
    PUZZLE: '#eab308',
    DOG: '#ef4444',
};

const classificationIcons = {
    STAR: Star,
    CASH_COW: DollarSign,
    PUZZLE: HelpCircle,
    DOG: Skull,
};

export default function MenuAnalysis() {
    const { data } = useQuery({
        queryKey: ['menu-analysis'],
        queryFn: () => api.get('/api/menu-analysis').then((r) => r.data.data),
    });

    const { data: matrixData } = useQuery({
        queryKey: ['menu-matrix'],
        queryFn: () => api.get('/api/menu-analysis/matrix').then((r) => r.data.data),
    });

    const scatterData = [
        ...(matrixData?.stars || []).map((i: any) => ({ ...i, classification: 'STAR' })),
        ...(matrixData?.cashCows || []).map((i: any) => ({ ...i, classification: 'CASH_COW' })),
        ...(matrixData?.puzzles || []).map((i: any) => ({ ...i, classification: 'PUZZLE' })),
        ...(matrixData?.dogs || []).map((i: any) => ({ ...i, classification: 'DOG' })),
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white">Análise de Cardápio</h1>
                <p className="text-gray-400">Matriz BCG e classificação ABC</p>
            </div>

            {/* Classification Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { key: 'STAR', label: 'Estrelas', desc: 'Alta popularidade + Alta margem', color: 'green' },
                    { key: 'CASH_COW', label: 'Vacas Leiteiras', desc: 'Alta popularidade + Baixa margem', color: 'blue' },
                    { key: 'PUZZLE', label: 'Puzzles', desc: 'Baixa popularidade + Alta margem', color: 'yellow' },
                    { key: 'DOG', label: 'Abacaxis', desc: 'Baixa popularidade + Baixa margem', color: 'red' },
                ].map((c) => {
                    const Icon = classificationIcons[c.key as keyof typeof classificationIcons];
                    const count = matrixData?.[c.key === 'STAR' ? 'stars' : c.key === 'CASH_COW' ? 'cashCows' : c.key === 'PUZZLE' ? 'puzzles' : 'dogs']?.length || 0;
                    return (
                        <div key={c.key} className={`stat-card border-l-4 border-${c.color}-500`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl bg-${c.color}-500/20`}>
                                    <Icon className={`w-5 h-5 text-${c.color}-400`} />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{c.label}</p>
                                    <p className="text-2xl font-bold text-white">{count}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">{c.desc}</p>
                        </div>
                    );
                })}
            </div>

            {/* Boston Matrix Chart */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">Matriz BCG</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis
                                type="number"
                                dataKey="popularity"
                                name="Popularidade"
                                stroke="#666"
                                domain={[0, 100]}
                                label={{ value: 'Popularidade', position: 'bottom', fill: '#666' }}
                            />
                            <YAxis
                                type="number"
                                dataKey="profitability"
                                name="Rentabilidade"
                                stroke="#666"
                                domain={[0, 100]}
                                label={{ value: 'Rentabilidade', angle: -90, position: 'left', fill: '#666' }}
                            />
                            <Tooltip
                                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                                labelFormatter={() => ''}
                            />
                            <Scatter data={scatterData} fill="#8b5cf6">
                                {scatterData.map((entry: any, index: number) => (
                                    <Cell key={index} fill={classificationColors[entry.classification as keyof typeof classificationColors]} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Items List */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">Itens do Cardápio</h3>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Vendas</th>
                                <th>Receita</th>
                                <th>Margem</th>
                                <th>Classificação</th>
                                <th>Ação Recomendada</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.items || []).slice(0, 10).map((item: any) => {
                                const Icon = classificationIcons[item.matrixClassification as keyof typeof classificationIcons] || Star;
                                return (
                                    <tr key={item.id}>
                                        <td className="font-medium text-white">{item.recipe?.name}</td>
                                        <td>{item.quantitySold}</td>
                                        <td>{formatCurrency(item.revenue)}</td>
                                        <td className={item.marginPercent >= 30 ? 'text-green-400' : 'text-yellow-400'}>
                                            {formatPercent(item.marginPercent)}
                                        </td>
                                        <td>
                                            <span className="flex items-center gap-2">
                                                <Icon className="w-4 h-4" style={{ color: classificationColors[item.matrixClassification as keyof typeof classificationColors] }} />
                                                <span style={{ color: classificationColors[item.matrixClassification as keyof typeof classificationColors] }}>
                                                    {item.matrixClassification}
                                                </span>
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-info">{item.recommendedAction}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
