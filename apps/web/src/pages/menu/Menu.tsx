import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import CategoryList from './components/CategoryList';
import MenuItemList from './components/MenuItemList';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Building, ChevronRight } from 'lucide-react';

export default function Menu() {
    const { user, switchRestaurant } = useAuthStore();
    const currentCostCenter = user?.costCenter;
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [isSelectingRestaurant, setIsSelectingRestaurant] = useState(true);
    const [loadingRestaurantId, setLoadingRestaurantId] = useState<string | null>(null);

    // Fetch restaurants for switcher
    const { data: restaurants } = useQuery({
        queryKey: ['my-restaurants'],
        queryFn: () => api.get('/api/restaurants').then(r => r.data.data),
        enabled: !!user
    });

    const handleRestaurantSelect = async (restaurantId: string) => {
        setLoadingRestaurantId(restaurantId);
        try {
            await switchRestaurant(restaurantId);
            setSelectedCategoryId(null);
            setIsSelectingRestaurant(false);
            // window.location.reload(); // Removed to prevent loop and rely on reactive state
        } catch (error) {
            console.error('Failed to switch restaurant', error);
        } finally {
            setLoadingRestaurantId(null);
        }
    };

    if (!currentCostCenter || isSelectingRestaurant) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cardápio</h1>
                    {isSelectingRestaurant && currentCostCenter && (
                        <button
                            onClick={() => setIsSelectingRestaurant(false)}
                            className="text-sm text-blue-600 hover:underline mb-2 block dark:text-blue-400"
                        >
                            &larr; Voltar para {currentCostCenter.name}
                        </button>
                    )}
                    <p className="text-gray-500 mt-2 dark:text-gray-400">Selecione um restaurante para gerenciar o cardápio.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {restaurants?.map((restaurant: any) => {
                        const isLoading = loadingRestaurantId === restaurant.id;
                        return (
                            <button
                                key={restaurant.id}
                                onClick={() => handleRestaurantSelect(restaurant.id)}
                                disabled={!!loadingRestaurantId}
                                className={`flex items-center p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md hover:border-primary-500 dark:hover:border-blue-500 transition-all text-left group
                                    ${isLoading ? 'opacity-75 cursor-wait ring-2 ring-blue-500' : ''}
                                    ${!!loadingRestaurantId && !isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="w-12 h-12 bg-primary-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4 group-hover:bg-primary-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                    {isLoading ? (
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 dark:border-blue-400"></div>
                                    ) : (
                                        <Building className="w-6 h-6 text-primary-600 dark:text-blue-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-gray-900 dark:text-white">
                                        {restaurant.name}
                                        {isLoading && <span className="ml-2 text-xs text-blue-500 font-normal">Carregando...</span>}
                                    </h3>
                                    {restaurant.code && <p className="text-xs text-gray-400 dark:text-gray-500">#{restaurant.code}</p>}
                                </div>
                                {!isLoading && <ChevronRight className="w-5 h-5 text-gray-300 dark:text-slate-600 group-hover:text-primary-500 dark:group-hover:text-blue-500" />}
                            </button>
                        );
                    })}

                    {(!restaurants || restaurants.length === 0) && (
                        <div className="col-span-full bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4">
                            <p className="text-yellow-700 dark:text-yellow-400">Não encontramos restaurantes vinculados à sua conta.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Cardápio do Restaurante</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-gray-300">
                            Gerenciando: <span className="font-medium text-white">{currentCostCenter.name}</span>
                        </p>
                        <button
                            onClick={() => setIsSelectingRestaurant(true)}
                            className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors"
                        >
                            Trocar
                        </button>
                    </div>
                </div>
                {/* Placeholder for global actions like "Preview PDV" */}
            </div>

            <div className="grid grid-cols-12 gap-6 h-full min-h-0">
                {/* Left Column: Categories */}
                <div className="col-span-4 bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
                    <CategoryList
                        costCenterId={currentCostCenter.id}
                        selectedCategoryId={selectedCategoryId}
                        onSelectCategory={setSelectedCategoryId}
                    />
                </div>

                {/* Right Column: Items */}
                <div className="col-span-8 bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
                    {selectedCategoryId ? (
                        <MenuItemList categoryId={selectedCategoryId} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50 dark:bg-slate-800/50">
                            <div className="text-5xl mb-4 text-gray-300 dark:text-gray-600">📋</div>
                            <p className="font-medium dark:text-gray-300">Selecione uma categoria</p>
                            <p className="text-sm dark:text-gray-500">Os itens aparecerão aqui</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
