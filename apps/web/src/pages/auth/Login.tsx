import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/auth';
import { Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginForm {
    email: string;
    password: string;
}

export default function Login() {
    const { login, isLoading } = useAuthStore();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

    const onSubmit = async (data: LoginForm) => {
        setError('');
        try {
            await login(data.email.toLowerCase().trim(), data.password);
            toast.success('Login realizado com sucesso!');
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer login');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
            {/* Background effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-4 bg-white rounded-2xl p-2">
                        <img src="/moby-dick-logo.png" alt="Moby Dick Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Moby Dick</h1>
                    <p className="text-gray-400">Gestão inteligente para seu restaurante</p>
                </div>

                {/* Form */}
                <div className="glass-card">
                    <h2 className="text-xl font-semibold text-white mb-6">Entrar na sua conta</h2>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label className="label">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
                                    placeholder="seu@email.com"
                                    {...register('email', { required: 'Email é obrigatório' })}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="label">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="password"
                                    className={`input pl-10 ${errors.password ? 'input-error' : ''}`}
                                    placeholder="••••••••"
                                    {...register('password', { required: 'Senha é obrigatória', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
                                />
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full h-12"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>


                </div>

                {/* Demo credentials */}

            </div>
        </div>
    );
}
