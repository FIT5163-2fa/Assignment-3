import {
  completeChessLoginCallback,
  createDebugUser,
  createUser,
  deleteUser,
  createTwoFactorKey,
  getAdminUsers,
  getDebugTotpCode,
  loginUser,
  resetUserTwoFactor,
  updateUserRole,
  validateTwoFactorCode,
} from "./lib/api"
import type { UserRole } from "./lib/api"

import { LoginPage } from "./components/LoginPage"
import { AdminDashboard } from "./components/AdminDashboard"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

import { useState } from "react"
import type { SyntheticEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { QRCodeSVG } from "qrcode.react"
import { getErrorMessage } from "./lib/utils"


type Page = "login" | "twoFactor" | "admin" | "chess"

type CurrentUser = {
  id: number
  username: string
  role?: UserRole
  email: string
  twoFactorSet: boolean
  // password: string
}

/*
const demoUsers: DemoUser[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    hashedEmail: "258d8dc916db8d1f2a2f146f67b82dd00741780873926d3bdfc006c7b1b2c143",
    password: "admin123",
    role: "admin",
    twoFactorSet: true,
  },
  {
    id: 2,
    username: "user",
    email: "user@example.com",
    hashedEmail: "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
    password: "user1234",
    role: "user",
    twoFactorSet: true,
  },
]
*/


export function App() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState<Page>("login")

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [totp, setTotp] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [totpValid, setTotpValid] = useState<boolean | null>(null)

  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("password123")
  const [newRole, setNewRole] = useState<UserRole>("user")
  const [adminActionError, setAdminActionError] = useState("")
  const [chessCallbackError, setChessCallbackError] = useState("")

  const queryParams = new URLSearchParams(window.location.search)
  const chessLoginState = queryParams.get("state")
  const chessCallbackUrl = queryParams.get("callback_url")
  const isChessLogin = chessLoginState !== null && chessCallbackUrl !== null

  const usersQuery = useQuery({
    queryKey: ["admin-users", accessToken],
    queryFn: () => {
      if (!accessToken) throw new Error("No access token")
      return getAdminUsers(accessToken)
    },
    enabled: page === "admin" && accessToken !== null,
  })

  function refreshAdminUsers() {
    return queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  }

  const validateTotp = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      return validateTwoFactorCode(currentUser.id, totp)
    },
    onSuccess: async (response) => {
      setAccessToken(response.token.access_token)
      setTotpValid(true)
      setCurrentUser((previousUser) => {
        if (!previousUser) return previousUser
        return {
          ...previousUser,
          id: response.user.id,
          username: response.user.username,
          role: response.user.role,
        }
      })

      if (response.user.role === "admin") {
        setPage("admin")
      }

      if (response.user.role === "user") {
        if (isChessLogin) {
          try {
            await completeChessLoginCallback(
              chessCallbackUrl,
              chessLoginState,
              response.user,
            )
          } catch (error) {
            setChessCallbackError(getErrorMessage(error))
            return
          }
        }
        setPage("chess")
      }
    },
  })

  // const debugCreateUser = useMutation({
  //   mutationFn: () => {
  //     if (currentUser === null) throw new Error("No current user")
  //     return createDebugUser(
  //       {
  //         username: currentUser.username,
  //         email: currentUser.email,
  //         password: currentUser.password,
  //       }
  //     )
  //   },
  //   onSuccess: (data) => {
  //     setCurrentUser((previousUser) => {
  //       if (!previousUser) return previousUser
  //       return {
  //         ...previousUser,
  //         id: data.id,
  //       }
  //     })
  //   },
  // })

  const createSecret = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      if (setupToken === null) {
        throw new Error("Please log in through the backend before creating a 2FA secret.")
      }
      return createTwoFactorKey(setupToken)
    },
    onSuccess: (uri) => {
      setTotpUri(uri)
      const parsedUri = uri.replace("otpauth://", "https://")
      const parsedUrl = new URL(parsedUri)
      const secretParam = parsedUrl.searchParams.get("secret")
      if (secretParam) setSecret(secretParam)
    },
  })

  const generateCode = useMutation({
    mutationFn: async () => {
      if (currentUser === null) throw new Error("No current user")
        return getDebugTotpCode(currentUser.id)
      },
      onSuccess: (code) => {
        setTotp(code)
        setTotpValid(null)
      },
    })

  // Handles the first login step before 2FA.
  // The user can continue only if the password is correct and 2FA is set.
  async function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError("")

    try {
      const loginResponse = await loginUser(loginEmail, loginPassword)

      setCurrentUser({
        id: loginResponse.user_id,
        username: loginResponse.username,
        email: loginEmail,
        twoFactorSet: loginResponse.two_factor_set,
      })
      setTotp("")
      setTotpValid(null)
      setSecret(null)
      setTotpUri(null)
      setAccessToken(null)
      setSetupToken(loginResponse.setup_token)
      setPage("twoFactor")
    } catch (error) {
      setLoginError(getErrorMessage(error))
      return
    }
  }

  function handleLogout() {
    setCurrentUser(null)
    setTotp("")
    setSecret(null)
    setTotpUri(null)
    setAccessToken(null)
    setSetupToken(null)
    setTotpValid(null)
    setChessCallbackError("")
    setPage("login")
  }

  // Adds a new user in the admin dashboard.
  async function handleAddUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setAdminActionError("")

    const trimmedUsername = newUsername.trim()
    const trimmedEmail = newEmail.trim()

    if (!trimmedUsername) {
      alert("Username cannot be empty.")
      return
    }

    if (!trimmedEmail) {
      alert("Email cannot be empty.")
      return
    }

    if (!accessToken) {
      alert("Admin token is missing. Please log in again.")
      return
    }

    try {
      const createdUser = await createUser({
        username: trimmedUsername,
        email: trimmedEmail,
        password: newPassword,
      })

      if (newRole !== createdUser.role) {
        await updateUserRole(createdUser.id, newRole, accessToken)
      }

      setNewUsername("")
      setNewEmail("")
      setNewPassword("password123")
      setNewRole("user")
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  async function handleResetTwoFactor(userId: number) {
    if (!accessToken) return
    setAdminActionError("")

    try {
      await resetUserTwoFactor(userId, accessToken)
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  async function handleUpdateRole(userId: number, role: UserRole) {
    if (!accessToken) return
    setAdminActionError("")

    try {
      await updateUserRole(userId, role, accessToken)
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  // Deletes a user from the admin table.
  // The last admin account is protected from being deleted.
  async function handleDeleteUser(userId: number) {
    if (!accessToken) return
    setAdminActionError("")
    const selectedUser = usersQuery.data?.find((userItem) => userItem.id === userId)

    if (selectedUser?.username === currentUser?.username) {
      setAdminActionError("The current admin account cannot be deleted here.")
      return
    }

    try {
      await deleteUser(userId, accessToken)
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  // Render the login page first. If the login is successful, App.tsx changes
  // the page state to the 2FA screen.
  if (page === "login") {
    return (
      <LoginPage
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        loginError={loginError}
        setLoginEmail={setLoginEmail}
        setLoginPassword={setLoginPassword}
        handleLogin={handleLogin}
      />
    )
  }

  if (page === "twoFactor") {
    return (
      <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          <h1 className="text-2xl font-bold">Two-Factor Verification</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Current user:{" "}
            <span className="font-semibold text-white">
              {currentUser?.username}
            </span>{" "}
            ({currentUser?.role})
          </p>

          {setupToken && (
            <div className="mt-6 rounded-xl border border-zinc-800 p-4">
              <h2 className="font-semibold">2FA Setup Required</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Password accepted. This account needs a 2FA secret before
                verification.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Current User Details</h2>
            <dl className="mt-3 grid grid-cols-[120px_1fr] gap-2 text-sm">
              <dt className="text-zinc-400">User ID</dt>
              <dd>{currentUser?.id}</dd>
              <dt className="text-zinc-400">Username</dt>
              <dd>{currentUser?.username}</dd>
              <dt className="text-zinc-400">Email</dt>
              <dd>{currentUser?.email}</dd>
              <dt className="text-zinc-400">2FA Set</dt>
              <dd>{currentUser?.twoFactorSet ? "Yes" : "No"}</dd>
            </dl>
          </div>

          {/*
          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Step 1: Prepare 2FA Account</h2>
            <p className="mt-1 text-sm text-zinc-400">
              This step sends the current user to the backend so that a 2FA
              secret can be created.
            </p>
            <button
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => debugCreateUser.mutate()}
              disabled={debugCreateUser.isPending}
            >
              Prepare User
            </button>

            {debugCreateUser.data && (
              <div className="mt-2 text-sm text-green-400">
                Backend user ID: {debugCreateUser.data.id}
              </div>
            )}

            {debugCreateUser.error && (
              <div className="mt-2 text-sm text-red-400">
                {debugCreateUser.error.message}
              </div>
            )}
          </div>
          */}

          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Step 2: Create 2FA secret</h2>
            <button
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => createSecret.mutate()}
              disabled={!currentUser || createSecret.isPending}
            >
              Create Secret
            </button>

            {secret && totpUri && (
              <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={totpUri} size={144} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-200">
                    Scan QR code or enter secret manually
                  </div>
                  <div className="mt-2 font-mono text-xs break-all text-zinc-400">
                    Secret: {secret}
                  </div>
                </div>
              </div>
            )}

            {createSecret.error && (
              <div className="mt-2 text-sm text-red-400">
                {createSecret.error.message}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Step 3: Enter TOTP code</h2>
            <p className="mt-1 text-sm text-zinc-400">
              The demo TOTP code is generated using HMAC-SHA256 and refreshes
              every 15 seconds.
            </p>

            <div className="mt-4 flex justify-center">
              <InputOTP
                maxLength={6}
                value={totp}
                onChange={(value) => {
                  setTotp(value)
                  setTotpValid(null)
                }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="mt-4 flex justify-center gap-3">
              <button
                className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                onClick={() => generateCode.mutate()}
                disabled={!currentUser || generateCode.isPending}
              >
                Generate Temporary Code
              </button>

              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                onClick={() => validateTotp.mutate()}
                disabled={totp.length < 6 || validateTotp.isPending}
              >
                Validate
              </button>
            </div>

            {totpValid === true && (
              <div className="mt-3 text-center text-green-400">
                Valid. Redirecting to the application...
              </div>
            )}

            {totpValid === false && (
              <div className="mt-3 text-center text-red-400">
                Invalid or expired TOTP code.
              </div>
            )}

            {generateCode.error && (
              <div className="mt-2 text-sm text-red-400">
                {generateCode.error.message}
              </div>
            )}

            {validateTotp.error && (
              <div className="mt-2 text-sm text-red-400">
                {validateTotp.error.message}
              </div>
            )}

            {chessCallbackError && (
              <div className="mt-2 text-sm text-red-400">
                {chessCallbackError}
              </div>
            )}
          </div>

          <button
            className="mt-6 w-full rounded-lg bg-zinc-700 px-4 py-2 text-white"
            onClick={handleLogout}
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (page === "admin") {
    return (
      <AdminDashboard
        users={usersQuery.data ?? []}
        newUsername={newUsername}
        newEmail={newEmail}
        newPassword={newPassword}
        newRole={newRole}
        setNewUsername={setNewUsername}
        setNewEmail={setNewEmail}
        setNewPassword={setNewPassword}
        setNewRole={setNewRole}
        handleAddUser={handleAddUser}
        handleResetTwoFactor={handleResetTwoFactor}
        handleUpdateRole={handleUpdateRole}
        handleDeleteUser={handleDeleteUser}
        handleLogout={handleLogout}
        isLoadingUsers={usersQuery.isLoading}
        errorMessage={usersQuery.error?.message}
        actionError={adminActionError}
      />
    )
  }

  if (page === "chess") {
    return (
      <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold">Chess Game Access Granted</h1>
          <p className="mt-3 text-sm text-zinc-400">
            {isChessLogin
              ? "You can now close this window."
              : "The user has passed password authentication and 2FA verification. This page can later be connected to the chess game implementation."}
          </p>

          <button
            className="mt-6 rounded-lg bg-zinc-700 px-4 py-2 text-white"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold">Unknown Page</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Return to login and try again.
        </p>

        <button
          className="mt-6 rounded-lg bg-zinc-700 px-4 py-2 text-white"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default App
