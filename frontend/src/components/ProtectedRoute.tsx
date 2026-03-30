import { Navigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  if (!user.isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
