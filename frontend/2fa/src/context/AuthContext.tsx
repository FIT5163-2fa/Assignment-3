import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react"

import { useNavigate, useSearchParams } from "react-router"
import {
  loginUser as loginUserApi,
  validateTwoFactorCode,
  completeChessLoginCallback,
} from "@/lib/api"
import type { UserRole } from "@/lib/api"
import { getErrorMessage } from "@/lib/utils"

export type CurrentUser = {
  id: number
  username: string
  role?: UserRole
  email: string
  twoFactorSet: boolean
}

type AuthContextType = {
  currentUser: CurrentUser | null
  accessToken: string | null
  setupToken: string | null
  chessLoginState: string | null
  chessCallbackUrl: string | null
  isChessLogin: boolean
  login: (email: string, password: string) => Promise<void>
  completeTwoFactor: (totp: string) => Promise<void>
  logout: () => void
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>
  setAccessToken: React.Dispatch<React.SetStateAction<string | null>>
  setSetupToken: React.Dispatch<React.SetStateAction<string | null>>
}

const AuthContext = createContext<AuthContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [setupToken, setSetupToken] = useState<string | null>(null)

  const chessLoginState = searchParams.get("state")
  const chessCallbackUrl = searchParams.get("callback_url")
  const isChessLogin =
    chessLoginState !== null && chessCallbackUrl !== null

  const chessCallbackErrorRef = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has("state") || !params.has("callback_url")) return

    const url = new URL(window.location.href)
    url.searchParams.delete("state")
    url.searchParams.delete("callback_url")
    window.history.replaceState({}, "", url.pathname + url.search)
  }, [])

  async function login(email: string, password: string) {
    const loginResponse = await loginUserApi(email, password)

    setCurrentUser({
      id: loginResponse.user_id,
      username: loginResponse.username,
      email,
      twoFactorSet: loginResponse.two_factor_set,
    })
    setSetupToken(loginResponse.setup_token)
    setAccessToken(null)
    navigate("/2fa")
  }

  async function completeTwoFactor(totp: string) {
    if (!currentUser) throw new Error("No current user")

    const response = await validateTwoFactorCode(currentUser.id, totp)

    setAccessToken(response.token.access_token)
    setCurrentUser((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        id: response.user.id,
        username: response.user.username,
        role: response.user.role,
        twoFactorSet: true,
      }
    })

    if (response.user.role === "admin") {
      navigate("/admin")
      return
    }

    if (isChessLogin) {
      try {
        await completeChessLoginCallback(
          chessCallbackUrl!,
          chessLoginState!,
          response.user,
        )
      } catch (error) {
        chessCallbackErrorRef.current = getErrorMessage(error)
      }
    }

    navigate("/chess")
  }

  function logout() {
    setCurrentUser(null)
    setAccessToken(null)
    setSetupToken(null)
    chessCallbackErrorRef.current = null
    navigate("/login")
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        accessToken,
        setupToken,
        chessLoginState,
        chessCallbackUrl,
        isChessLogin,
        login,
        completeTwoFactor,
        logout,
        setCurrentUser,
        setAccessToken,
        setSetupToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
