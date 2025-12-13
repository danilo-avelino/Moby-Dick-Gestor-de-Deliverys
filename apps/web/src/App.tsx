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
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import InventoryActiveSession from './pages/inventory/InventoryActiveSession';
import InventoryCategoryCount from './pages/inventory/InventoryCategoryCount';
import InventoryPublicCount from './pages/inventory/InventoryPublicCount';
import Recipes from './pages/recipes/Recipes';
import RecipeForm from './pages/recipes/RecipeForm';
import CMV from './pages/cmv/CMV';
import MenuAnalysis from './pages/menu-analysis/MenuAnalysis';
import Alerts from './pages/alerts/Alerts';
import Goals from './pages/goals/Goals';
import Integrations from './pages/integrations/Integrations';
import Purchases from './pages/purchases/Purchases';
import PurchaseLists from './pages/purchases/PurchaseLists';
import PurchaseListDetail from './pages/purchases/PurchaseListDetail';
import Settings from './pages/settings/Settings';
import WorkTimes from './pages/work-times/WorkTimes';
import NPS from './pages/nps/NPS';
import ChefRequests from './pages/stock-requests/ChefRequests';
import ManagerRequests from './pages/stock-requests/ManagerRequests';
import UserManagement from './pages/admin/UserManagement';
import RecentOrders from './pages/pdv/RecentOrders';
import NewOrder from './pages/pdv/NewOrder';
import CashRegister from './pages/pdv/CashRegister';
import OrderHistory from './pages/pdv/OrderHistory';

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

function DirectorRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    if (user?.role !== 'DIRETOR') return <Navigate to="/" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/inventory/share/:token/:categoryId" element={<InventoryPublicCount />} />

                {/* Protected routes */}
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="products/new" element={<ProductForm />} />
                    <Route path="products/:id" element={<ProductForm />} />
                    <Route path="stock" element={<Stock />} />
                    <Route path="stock/entry" element={<StockEntry />} />
                    <Route path="stock/requests" element={<ManagerRequests />} />
                    <Route path="stock/my-requests" element={<ChefRequests />} />
                    <Route path="stock/inventory" element={<InventoryDashboard />} />
                    <Route path="stock/inventory/:id" element={<InventoryActiveSession />} />
                    <Route path="stock/inventory/:id/count/:categoryId" element={<InventoryCategoryCount />} />
                    <Route path="recipes" element={<Recipes />} />
                    <Route path="recipes/new" element={<RecipeForm />} />
                    <Route path="recipes/:id" element={<RecipeForm />} />
                    <Route path="cmv" element={<CMV />} />
                    <Route path="menu-analysis" element={<MenuAnalysis />} />
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="goals" element={<Goals />} />
                    <Route path="integrations" element={<Integrations />} />
                    <Route path="purchases" element={<PurchaseLists />} />
                    <Route path="purchases/:id" element={<PurchaseListDetail />} />
                    <Route path="purchases/ai" element={<Purchases />} />
                    <Route path="settings" element={<DirectorRoute><Settings /></DirectorRoute>} />
                    <Route path="work-times" element={<WorkTimes />} />
                    <Route path="nps" element={<NPS />} />
                    <Route path="admin/users" element={<UserManagement />} />

                    {/* PDV Routes */}
                    <Route path="pdv" element={<RecentOrders />} />
                    <Route path="pdv/new" element={<NewOrder />} />
                    <Route path="pdv/cash" element={<CashRegister />} />
                    <Route path="pdv/history" element={<OrderHistory />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
