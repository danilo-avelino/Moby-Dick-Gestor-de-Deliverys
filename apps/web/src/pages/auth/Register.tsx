import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/auth';
import { ChefHat, Mail, Lock, User, Building, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface RegisterForm {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    restaurantName: string;
}

export default function Register() {
    const { register: registerUser, isLoading } = useAuthStore();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>();

    const onSubmit = async (data: RegisterForm) => {
        setError('');
        try {
            await registerUser(data);
            toast.success('Conta criada com sucesso!');
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar conta');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 mb-4">
                        <ChefHat className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Criar Conta</h1>
                    <p className="text-gray-400">Comece a gerenciar seu restaurante</p>
                </div>

                <div className="glass-card">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type="text"
                                        className={`input pl-10 ${errors.firstName ? 'input-error' : ''}`}
                                        placeholder="João"
                                        {...register('firstName', { required: 'Obrigatório' })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Sobrenome</label>
                                <input
                                    type="text"
                                    className={`input ${errors.lastName ? 'input-error' : ''}`}
                                    placeholder="Silva"
                                    {...register('lastName', { required: 'Obrigatório' })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">Nome do Restaurante</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    className={`input pl-10 ${errors.restaurantName ? 'input-error' : ''}`}
                                    placeholder="Burger House"
                                    {...register('restaurantName', { required: 'Obrigatório' })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
                                    placeholder="seu@email.com"
                                    {...register('email', { required: 'Obrigatório' })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="password"
                                    className={`input pl-10 ${errors.password ? 'input-error' : ''}`}
                                    placeholder="••••••••"
                                    {...register('password', { required: 'Obrigatório', minLength: { value: 6, message: 'Mínimo 6' } })}
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading} className="btn-primary w-full h-12">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Conta Grátis'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-gray-400 text-sm">
                        Já tem uma conta?{' '}
                        <Link to="/login" className="text-primary-400 hover:text-primary-300">Entrar</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
