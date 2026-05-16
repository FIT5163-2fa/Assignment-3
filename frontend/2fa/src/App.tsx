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

const API_BASE = "http://localhost:8000"
const TOTP_DURATION_SEC = 15

type Page = "login" | "twoFactor" | "admin" | "chess"

type UserRole = "admin" | "user"

type DemoUser = {
  id: number
  username: string
  email: string
  password: string
  role: UserRole
  keygenEnabled: boolean
}

const demoUsers: DemoUser[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
    keygenEnabled: true,
  },
  {
    id: 2,
    username: "user",
    email: "user@example.com",
    password: "user1234",
    role: "user",
    keygenEnabled: true,
  },
]

async function validateTotpCode(userId: number, totpCode: string) {
  const res = await fetch(
    `${API_BASE}/validate_2fa_key?user_id=${userId}&user_totp=${totpCode}`
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<boolean>
}

async function createDebugUser(
  username: string,
  email: string,
  password: string
) {
  const res = await fetch(`${API_BASE}/DEBUG_CREATE_USER`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ id: number; username: string }>
}

async function createSecretKey(userId: number) {
  const res = await fetch(`${API_BASE}/create_key?user_id=${userId}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ uri: string }>
}

function base64urlDecode(input: string): ArrayBuffer {
  const base64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=")

  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)

  for (let index = 0; index < binary.length; index++) {
    view[index] = binary.charCodeAt(index)
  }

  return buffer
}

async function generateTotp(secret: ArrayBuffer): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / TOTP_DURATION_SEC)

  const counterBuffer = new ArrayBuffer(8)
  new DataView(counterBuffer).setBigInt64(0, BigInt(counter), false)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const hash = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, counterBuffer)
  )

  const offset = hash[hash.length - 1] & 0b1111
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3]

  return (binary % 1_000_000).toString().padStart(6, "0")
}

export function App() {
  const [page, setPage] = useState<Page>("login")

  const [loginUsername, setLoginUsername] = useState("admin")
  const [loginPassword, setLoginPassword] = useState("admin123")
  const [loginError, setLoginError] = useState("")

  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null)
  const [users, setUsers] = useState<DemoUser[]>(demoUsers)

  const [totp, setTotp] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [totpValid, setTotpValid] = useState<boolean | null>(null)

  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("password123")
  const [newRole, setNewRole] = useState<UserRole>("user")

  const validateTotp = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      return validateTotpCode(currentUser.id, totp)
    },
    onSuccess: (data) => {
      setTotpValid(data)

      if (data && currentUser?.role === "admin") {
        setPage("admin")
      }

      if (data && currentUser?.role === "user") {
        setPage("chess")
      }
    },
  })

  const debugCreateUser = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      return createDebugUser(
        currentUser.username,
        currentUser.email,
        currentUser.password
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
      return createSecretKey(currentUser.id)
    },
    onSuccess: (data) => {
      const uri = data.uri.replace("otpauth://", "https://")
      const parsedUrl = new URL(uri)
      const secretParam = parsedUrl.searchParams.get("secret")
      if (secretParam) setSecret(secretParam)
    },
  })

  const generateCode = useMutation({
    mutationFn: async () => {
      if (!secret) throw new Error("No secret key")
      return generateTotp(base64urlDecode(secret))
    },
    onSuccess: (code) => {
      setTotp(code)
      setTotpValid(null)
    },
  })

  // Handles the first login step before 2FA.
  // The user can continue only if the password is correct
  // and the keygen account is enabled.
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

    if (!matchedUser.keygenEnabled) {
      setLoginError("This user's 2FA keygen account is disabled.")
      return
    }

    setCurrentUser(matchedUser)
    setTotp("")
    setTotpValid(null)
    setSecret(null)
    setPage("twoFactor")
  }

  function handleLogout() {
    setCurrentUser(null)
    setTotp("")
    setSecret(null)
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
      keygenEnabled: true,
    }

    setUsers([...users, nextUser])
    setNewUsername("")
    setNewEmail("")
    setNewPassword("password123")
    setNewRole("user")
  }

  // Enables or disables a user's keygen account.
  // Disabled users are blocked from entering the 2FA step.
  function handleToggleKeygen(userId: number) {
    const updatedUsers = users.map((userItem) => {
      if (userItem.id === userId) {
        return {
          ...userItem,
          keygenEnabled: !userItem.keygenEnabled,
        }
      }

      return userItem
    })

    setUsers(updatedUsers)
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

            {secret && (
              <div className="mt-2 font-mono text-xs break-all text-zinc-400">
                Secret: {secret}
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
                disabled={!secret || generateCode.isPending}
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
        handleToggleKeygen={handleToggleKeygen}
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
