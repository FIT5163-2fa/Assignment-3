import { useEffect, useState, type ReactNode } from "react"
import { Navigate } from "react-router"
import { useAuth } from "@/context/AuthContext"

type RequireAuthProps = {
  children: ReactNode
  requireAccessToken?: boolean
  requireAdmin?: boolean
}

export function RequireAuth({
  children,
  requireAccessToken = false,
  requireAdmin = false,
}: RequireAuthProps) {
  const { currentUser, accessToken } = useAuth()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (requireAccessToken && !accessToken) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && currentUser.role !== "admin") {
    return <Navigate to="/login" replace />
  }

  return children
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { currentUser, accessToken, isChessLogin, completeChessLogin } = useAuth()
  const [chessCallbackPending, setChessCallbackPending] = useState(isChessLogin)

  useEffect(() => {
    if (!currentUser || !accessToken || !isChessLogin) return

    let cancelled = false
    completeChessLogin().finally(() => {
      if (!cancelled) setChessCallbackPending(false)
    })
    return () => { cancelled = true }
  }, [currentUser, accessToken, isChessLogin, completeChessLogin])

  if (currentUser && accessToken) {
    if (isChessLogin && chessCallbackPending) return null

    const destination = currentUser.role === "admin" ? "/admin" : "/chess"
    return <Navigate to={destination} replace />
  }

  return children
}
