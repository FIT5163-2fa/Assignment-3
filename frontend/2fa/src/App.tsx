import {
  createDebugUser,
  createTwoFactorKey,
  getDebugTotpCode,
  resetUserTwoFactor,
  validateTwoFactorCode,
} from "./lib/api"

import { LoginPage } from "./components/LoginPage"
import { AdminDashboard } from "./components/AdminDashboard"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

import { useState } from "react"
import type { SyntheticEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { QRCodeSVG } from "qrcode.react"


type Page = "login" | "twoFactor" | "admin" | "chess"

type UserRole = "admin" | "user"

type DemoUser = {
  id: number
  username: string
  email: string
  password: string
  role: UserRole
  twoFactorSet: boolean
}

const demoUsers: DemoUser[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
    twoFactorSet: true,
  },
  {
    id: 2,
    username: "user",
    email: "user@example.com",
    password: "user1234",
    role: "user",
    twoFactorSet: true,
  },
]


export function App() {
  const [page, setPage] = useState<Page>("login")

  const [loginUsername, setLoginUsername] = useState("admin")
  const [loginPassword, setLoginPassword] = useState("admin123")
  const [loginError, setLoginError] = useState("")

  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null)
  const [users, setUsers] = useState<DemoUser[]>(demoUsers)

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

  const validateTotp = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      return validateTwoFactorCode(currentUser.id, totp)
    },
    onSuccess: (token) => {
      setAccessToken(token)
      setTotpValid(true)

      if (currentUser?.role === "admin") {
        setPage("admin")
      }

      if (currentUser?.role === "user") {
        setPage("chess")
      }
    },
  })

  const debugCreateUser = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      return createDebugUser(
        {
          username: currentUser.username,
          email: currentUser.email,
          password: currentUser.password,
        }
      )
    },
    onSuccess: (data) => {
      setCurrentUser((previousUser) => {
        if (!previousUser) return previousUser
        return {
          ...previousUser,
          id: data.id,
        }
      })
    },
  })

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
  function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoginError("")

    const matchedUser = users.find(
      (userItem) =>
        userItem.username === loginUsername &&
        userItem.password === loginPassword
    )

    if (!matchedUser) {
      setLoginError("Invalid username or password.")
      return
    }

    if (!matchedUser.twoFactorSet) {
      setLoginError("This user needs to set up 2FA before verification.")
      return
    }

    setCurrentUser(matchedUser)
    setTotp("")
    setTotpValid(null)
    setSecret(null)
    setTotpUri(null)
    setAccessToken(null)
    setSetupToken(null)
    setPage("twoFactor")
  }

  function handleLogout() {
    setCurrentUser(null)
    setTotp("")
    setSecret(null)
    setTotpUri(null)
    setAccessToken(null)
    setSetupToken(null)
    setTotpValid(null)
    setPage("login")
  }

  // Adds a new user in the admin dashboard.
  // The user is stored in frontend state for the current demo.
  function handleAddUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedUsername = newUsername.trim()

    if (!trimmedUsername) {
      alert("Username cannot be empty.")
      return
    }

    const usernameAlreadyExists = users.some(
      (userItem) =>
        userItem.username.toLowerCase() === trimmedUsername.toLowerCase()
    )
    if (usernameAlreadyExists) {
      alert("This username already exists.")
      return
    }

    const nextUser: DemoUser = {
      id: Date.now(),
      username: trimmedUsername,
      email: newEmail.trim() || `${trimmedUsername}@example.com`,
      password: newPassword,
      role: newRole,
      twoFactorSet: true,
    }

    setUsers([...users, nextUser])
    setNewUsername("")
    setNewEmail("")
    setNewPassword("password123")
    setNewRole("user")
  }

  async function handleResetTwoFactor(userId: number) {
    if (accessToken) {
      await resetUserTwoFactor(userId, accessToken)
    }

    setUsers((previousUsers) =>
      previousUsers.map((userItem) =>
        userItem.id === userId ? { ...userItem, twoFactorSet: false } : userItem,
      ),
    )
  }

  // Deletes a user from the admin table.
  // The current admin account is protected from being deleted.
  function handleDeleteUser(userId: number) {
    const selectedUser = users.find((userItem) => userItem.id === userId)

    if (selectedUser?.username === currentUser?.username) {
      alert("The current admin account cannot be deleted.")
      return
    }

    const updatedUsers = users.filter((userItem) => userItem.id !== userId)
    setUsers(updatedUsers)
  }

  // Render the login page first. If the login is successful, App.tsx changes
  // the page state to the 2FA screen.
  if (page === "login") {
    return (
      <LoginPage
        loginUsername={loginUsername}
        loginPassword={loginPassword}
        loginError={loginError}
        setLoginUsername={setLoginUsername}
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

          <div className="mt-6 rounded-xl border border-zinc-800 p-4">
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
        users={users}
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
        handleDeleteUser={handleDeleteUser}
        handleLogout={handleLogout}
      />
    )
  }

  return (
    <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold">Chess Game Access Granted</h1>
        <p className="mt-3 text-sm text-zinc-400">
          The user has passed password authentication and 2FA verification. This
          page can later be connected to the chess game implementation.
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
