import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { RequireAuth } from "@/components/RequireAuth"
import { AuthProvider } from "@/context/AuthContext"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import { TwoFactorPage } from "@/pages/TwoFactorPage"
import { TwoFactorSetupPage } from "@/pages/TwoFactorSetupPage"
import { AdminPage } from "@/pages/AdminPage"
import { ChessPage } from "@/pages/ChessPage"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/2fa/setup"
            element={
              <RequireAuth>
                <TwoFactorSetupPage />
              </RequireAuth>
            }
          />
          <Route
            path="/2fa"
            element={
              <RequireAuth>
                <TwoFactorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth requireAccessToken requireAdmin>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path="/chess"
            element={
              <RequireAuth requireAccessToken>
                <ChessPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
