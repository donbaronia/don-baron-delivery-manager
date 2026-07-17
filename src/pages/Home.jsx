import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import Portal from '@/pages/motoboy/Portal';

export default function Home() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Portal />;
}