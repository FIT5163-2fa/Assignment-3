import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import { AuthProvider } from "@/context/AuthContext"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import { TwoFactorPage } from "@/pages/TwoFactorPage"
import { AdminPage } from "@/pages/AdminPage"
import { ChessPage } from "@/pages/ChessPage"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/2fa" element={<TwoFactorPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/chess" element={<ChessPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
