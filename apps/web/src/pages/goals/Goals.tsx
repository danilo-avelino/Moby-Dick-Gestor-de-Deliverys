import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatPercent } from '../../lib/utils';
import { Target, Trophy, Star, Award } from 'lucide-react';

export default function Goals() {
    const { data: goals } = useQuery({
        queryKey: ['my-goals'],
        queryFn: () => api.get('/api/goals/my').then((r) => r.data.data),
    });

    const { data: leaderboard } = useQuery({
        queryKey: ['leaderboard'],
        queryFn: () => api.get('/api/goals/leaderboard').then((r) => r.data.data),
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white">Metas e Gamificação</h1>
                <p className="text-gray-400">Acompanhe suas metas e conquistas</p>
            </div>

            {/* My Goals */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary-400" /> Minhas Metas
                </h3>
                {(goals || []).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Nenhuma meta ativa</p>
                ) : (
                    <div className="space-y-4">
                        {(goals || []).map((goal: any) => (
                            <div key={goal.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-medium text-white">{goal.name}</h4>
                                        <p className="text-sm text-gray-400">{goal.description}</p>
                                    </div>
                                    <span className={`badge ${goal.achievedAt ? 'badge-success' : 'badge-purple'}`}>
                                        {goal.achievedAt ? 'Conquistada!' : `${goal.daysLeft}d restantes`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="progress-bar">
                                            <div
                                                className={`progress-bar-fill ${goal.achievedAt ? 'bg-green-500' : 'bg-primary-500'}`}
                                                style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-400">
                                        {formatPercent(goal.progressPercent)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Leaderboard */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" /> Ranking
                </h3>
                <div className="space-y-3">
                    {(leaderboard || []).map((entry: any, i: number) => (
                        <div
                            key={entry.user?.id || i}
                            className={`flex items-center gap-4 p-3 rounded-xl ${i < 3 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : 'bg-white/5'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-yellow-500 text-black' :
                                    i === 1 ? 'bg-gray-400 text-black' :
                                        i === 2 ? 'bg-orange-600 text-white' :
                                            'bg-white/10 text-gray-400'
                                }`}>
                                {i + 1}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-white">{entry.user?.firstName} {entry.user?.lastName}</p>
                                <p className="text-sm text-gray-400">{entry.achievementCount} conquistas</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-400" />
                                <span className="font-bold text-white">{entry.totalPoints}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
