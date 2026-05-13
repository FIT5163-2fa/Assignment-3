import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"

const API_BASE = "http://localhost:8000"

async function validateTotpCode(userId: number, totpCode: string) {
  const res = await fetch(
    `${API_BASE}/validate_2fa_key?user_id=${userId}&user_totp=${totpCode}`
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<boolean>
}

async function createDebugUser(username: string) {
  const res = await fetch(
    `${API_BASE}/DEBUG_CREATE_USER?username=${encodeURIComponent(username)}`,
    { method: "POST" }
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ id: number; username: string }>
}

const TOTP_DURATION_SEC = 15

function base64urlDecode(input: string): ArrayBuffer {
  const base64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=")
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i)
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

  const off = hash[hash.length - 1] & 0b1111
  const binary =
    ((hash[off] & 0x7f) << 24) |
    (hash[off + 1] << 16) |
    (hash[off + 2] << 8) |
    hash[off + 3]

  return (binary % 1_000_000).toString().padStart(6, "0")
}

async function createSecretKey(userId: number) {
  const res = await fetch(`${API_BASE}/create_key?user_id=${userId}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ key: string }>
}

export function App() {
  const [totp, setTotp] = useState("")
  const [username, setUsername] = useState("")
  const [userId, setUserId] = useState<number | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [totpValid, setTotpValid] = useState<boolean | null>(null)

  const validateTotp = useMutation({
    mutationFn: () => {
      if (userId === null) throw new Error("No user ID")
      return validateTotpCode(userId, totp)
    },
    onSuccess: (data) => setTotpValid(data),
  })

  const debugCreateUser = useMutation({
    mutationFn: () => createDebugUser(username),
    onSuccess: (data) => setUserId(data.id),
  })

  const createSecret = useMutation({
    mutationFn: () => {
      if (userId === null) throw new Error("No user ID")
      return createSecretKey(userId)
    },
    onSuccess: (data) => setSecret(data.key),
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

  return (
    <div className="flex min-h-svh min-w-svw flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="text-lg font-semibold">Debug: Create User</div>
        <div className="flex gap-2">
          <input
            className="rounded border px-2 py-1"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
            onClick={() => debugCreateUser.mutate()}
            disabled={!username || debugCreateUser.isPending}
          >
            Create
          </button>
        </div>
        {debugCreateUser.data && (
          <div className="text-sm text-gray-600">
            Created user — ID:{" "}
            <span className="font-mono font-bold">
              {debugCreateUser.data.id}
            </span>
          </div>
        )}
        {debugCreateUser.error && (
          <div className="text-sm text-red-500">
            {debugCreateUser.error.message}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-lg font-semibold">Create 2FA Secret</div>
        <button
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
          onClick={() => createSecret.mutate()}
          disabled={userId === null || createSecret.isPending}
        >
          {userId === null ? "Create a user first" : "Create Secret"}
        </button>
        {secret && (
          <div className="font-mono text-xs break-all text-gray-600">
            {secret}
          </div>
        )}
        {createSecret.error && (
          <div className="text-sm text-red-500">
            {createSecret.error.message}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-lg font-semibold">Enter TOTP</div>

        <InputOTP
          maxLength={6}
          value={totp}
          onChange={(v) => {
            setTotp(v)
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

        <div className="flex gap-2">
          <button
            className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
            onClick={() => generateCode.mutate()}
            disabled={!secret || generateCode.isPending}
          >
            Generate
          </button>
          <button
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
            onClick={() => validateTotp.mutate()}
            disabled={
              totp.length < 6 || userId === null || validateTotp.isPending
            }
          >
            Validate
          </button>
        </div>
        {generateCode.error && (
          <div className="text-sm text-red-500">
            {generateCode.error.message}
          </div>
        )}

        {totpValid === true && <div className="text-green-600">Valid!</div>}
        {totpValid === false && <div className="text-red-500">Invalid</div>}
        {validateTotp.error && (
          <div className="text-sm text-red-500">
            {validateTotp.error.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
