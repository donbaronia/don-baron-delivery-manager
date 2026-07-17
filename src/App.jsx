import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Dashboard from '@/pages/admin/Dashboard';
import Cadastro from '@/pages/admin/Cadastro';
import Financeiro from '@/pages/admin/Financeiro';
import Auditoria from '@/pages/admin/Auditoria';
import Configuracoes from '@/pages/admin/Configuracoes';
import ControlePresenca from '@/pages/admin/ControlePresenca';
import AgenteSeguranca from '@/pages/admin/AgenteSeguranca';
import ConsumoMotoboy from '@/pages/admin/ConsumoMotoboy';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<Home />} />
        <Route element={<Layout />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/cadastro" element={<Cadastro />} />
          <Route path="/admin/financeiro" element={<Financeiro />} />
          <Route path="/admin/auditoria" element={<Auditoria />} />
          <Route path="/admin/configuracoes" element={<Configuracoes />} />
          <Route path="/admin/presenca" element={<ControlePresenca />} />
          <Route path="/admin/agente-seguranca" element={<AgenteSeguranca />} />
          <Route path="/admin/consumo" element={<ConsumoMotoboy />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App