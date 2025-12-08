import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import Products from './pages/products/Products';
import ProductForm from './pages/products/ProductForm';
import Stock from './pages/stock/Stock';
import StockEntry from './pages/stock/StockEntry';
import Recipes from './pages/recipes/Recipes';
import RecipeForm from './pages/recipes/RecipeForm';
import CMV from './pages/cmv/CMV';
import MenuAnalysis from './pages/menu-analysis/MenuAnalysis';
import Alerts from './pages/alerts/Alerts';
import Goals from './pages/goals/Goals';
import Integrations from './pages/integrations/Integrations';
import Purchases from './pages/purchases/Purchases';
import Settings from './pages/settings/Settings';
import WorkTimes from './pages/work-times/WorkTimes';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuthStore();
    if (isAuthenticated) return <Navigate to="/" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

                {/* Protected routes */}
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="products/new" element={<ProductForm />} />
                    <Route path="products/:id" element={<ProductForm />} />
                    <Route path="stock" element={<Stock />} />
                    <Route path="stock/entry" element={<StockEntry />} />
                    <Route path="recipes" element={<Recipes />} />
                    <Route path="recipes/new" element={<RecipeForm />} />
                    <Route path="recipes/:id" element={<RecipeForm />} />
                    <Route path="cmv" element={<CMV />} />
                    <Route path="menu-analysis" element={<MenuAnalysis />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="goals" element={<Goals />} />
                    <Route path="integrations" element={<Integrations />} />
                    <Route path="purchases" element={<Purchases />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="work-times" element={<WorkTimes />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
