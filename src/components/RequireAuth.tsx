import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface RequireAuthProps {
  children: React.ReactNode;
  role?: 'ADMIN' | 'GUARD';
}

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { token, user } = useAuthStore();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
