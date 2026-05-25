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
  validateToken: string | null
  twoFactorSecret: string | null
  chessLoginState: string | null
  chessCallbackUrl: string | null
  isChessLogin: boolean
  login: (email: string, password: string) => Promise<void>
  completeTwoFactor: (totp: string) => Promise<void>
  setTwoFactorSecret: (secret: string | null) => void
  logout: () => void
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>
  setAccessToken: React.Dispatch<React.SetStateAction<string | null>>
  setSetupToken: React.Dispatch<React.SetStateAction<string | null>>
  setValidateToken: React.Dispatch<React.SetStateAction<string | null>>
}

const AuthContext = createContext<AuthContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

// DEV: Persist the 2FA secret to localStorage for convenience during development.
const TWO_FACTOR_SECRET_KEY = "2fa_secret"
const ACCESS_TOKEN_KEY = "access_token"
const CURRENT_USER_KEY = "current_user"

function loadFromStorage<T>(key: string, parse?: boolean): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return parse ? (JSON.parse(raw) as T) : (raw as T)
  } catch {
    return null
  }
}

function saveToStorage(key: string, value: string | null) {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    console.log(`Failed to access localStorage for key: ${key}`)
  }
}

function loadSecretFromStorage(): string | null {
  return loadFromStorage<string>(TWO_FACTOR_SECRET_KEY)
}

function saveSecretToStorage(secret: string | null) {
  saveToStorage(TWO_FACTOR_SECRET_KEY, secret)
}

function loadCurrentUserFromStorage(): CurrentUser | null {
  return loadFromStorage<CurrentUser>(CURRENT_USER_KEY, true)
}

function saveCurrentUserToStorage(user: CurrentUser | null) {
  saveToStorage(CURRENT_USER_KEY, user ? JSON.stringify(user) : null)
}

function loadAccessTokenFromStorage(): string | null {
  return loadFromStorage<string>(ACCESS_TOKEN_KEY)
}

function saveAccessTokenToStorage(token: string | null) {
  saveToStorage(ACCESS_TOKEN_KEY, token)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(
    loadCurrentUserFromStorage
  )
  const [accessToken, setAccessToken] = useState<string | null>(
    loadAccessTokenFromStorage
  )
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [validateToken, setValidateToken] = useState<string | null>(null)
  const [twoFactorSecret, setTwoFactorSecretState] = useState<string | null>(
    loadSecretFromStorage
  )

  const [chessLoginState] = useState<string | null>(() =>
    searchParams.get("state")
  )
  const [chessCallbackUrl] = useState<string | null>(() =>
    searchParams.get("callback_url")
  )
  const isChessLogin = chessLoginState !== null && chessCallbackUrl !== null

  const chessCallbackErrorRef = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has("state") || !params.has("callback_url")) return

    const url = new URL(window.location.href)
    url.searchParams.delete("state")
    url.searchParams.delete("callback_url")
    window.history.replaceState({}, "", url.pathname + url.search)
  }, [])

  function setTwoFactorSecret(secret: string | null) {
    setTwoFactorSecretState(secret)
    saveSecretToStorage(secret)
  }

  function persistCurrentUser(
    action: React.SetStateAction<CurrentUser | null>
  ) {
    setCurrentUser((prev) => {
      const next = typeof action === "function" ? action(prev) : action
      saveCurrentUserToStorage(next)
      return next
    })
  }

  function persistAccessToken(
    action: React.SetStateAction<string | null>
  ) {
    setAccessToken((prev) => {
      const next = typeof action === "function" ? action(prev) : action
      saveAccessTokenToStorage(next)
      return next
    })
  }

  async function login(email: string, password: string) {
    const loginResponse = await loginUserApi(email, password)

    setCurrentUser({
      id: loginResponse.user_id,
      username: loginResponse.username,
      email,
      twoFactorSet: loginResponse.two_factor_set,
    })
    saveCurrentUserToStorage({
      id: loginResponse.user_id,
      username: loginResponse.username,
      email,
      twoFactorSet: loginResponse.two_factor_set,
    })
    setSetupToken(loginResponse.setup_token)
    setValidateToken(loginResponse.validate_token)
    setAccessToken(null)
    saveAccessTokenToStorage(null)

    if (!loginResponse.two_factor_set) {
      navigate("/2fa/setup")
    } else {
      navigate("/2fa")
    }
  }

  async function completeTwoFactor(totp: string) {
    if (!currentUser) throw new Error("No current user")
    if (!validateToken)
      throw new Error("Missing validate token. Please log in again.")

    const response = await validateTwoFactorCode(
      currentUser.id,
      totp,
      validateToken
    )

    setSetupToken(null)
    setAccessToken(response.token.access_token)
    saveAccessTokenToStorage(response.token.access_token)
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
    saveCurrentUserToStorage({
      ...currentUser,
      id: response.user.id,
      username: response.user.username,
      role: response.user.role,
      twoFactorSet: true,
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
          response.token.access_token,
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
    saveCurrentUserToStorage(null)
    saveAccessTokenToStorage(null)
    setSetupToken(null)
    setValidateToken(null)
    setTwoFactorSecret(null)
    chessCallbackErrorRef.current = null
    navigate("/login")
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        accessToken,
        setupToken,
        validateToken,
        twoFactorSecret,
        chessLoginState,
        chessCallbackUrl,
        isChessLogin,
        login,
        completeTwoFactor,
        setTwoFactorSecret,
        logout,
        setCurrentUser: persistCurrentUser,
        setAccessToken: persistAccessToken,
        setSetupToken,
        setValidateToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
