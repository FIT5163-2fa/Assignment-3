import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { RequireAuth, RedirectIfAuthenticated } from "@/components/RequireAuth"
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
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <RegisterPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/2fa/setup"
            element={
              <RedirectIfAuthenticated>
                <RequireAuth>
                  <TwoFactorSetupPage />
                </RequireAuth>
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/2fa"
            element={
              <RedirectIfAuthenticated>
                <RequireAuth>
                  <TwoFactorPage />
                </RequireAuth>
              </RedirectIfAuthenticated>
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
