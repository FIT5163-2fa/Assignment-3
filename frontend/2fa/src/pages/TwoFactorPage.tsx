import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useAuth } from "@/context/AuthContext"
import { generateTotp } from "@/lib/api"
import { getErrorMessage } from "@/lib/utils"

function base32Decode(base32: string): ArrayBuffer {
  const cleaned = base32.replace(/[=]+$/, "").toUpperCase()
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of cleaned) {
    const idx = chars.indexOf(char)
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }

  return new Uint8Array(bytes).buffer
}

export function TwoFactorPage() {
  const { currentUser, twoFactorSecret, completeTwoFactor, logout } = useAuth()

  const [totp, setTotp] = useState("")
  const [manualSecret, setManualSecret] = useState("")
  const [totpValid, setTotpValid] = useState<boolean | null>(null)
  const [validationError, setValidationError] = useState("")

  const activeSecret = twoFactorSecret || manualSecret

  const generateCode = useMutation({
    mutationFn: async () => {
      if (!activeSecret) throw new Error("No secret available. Enter your 2FA secret below.")
      const secretBuffer = base32Decode(activeSecret)
      return generateTotp(secretBuffer)
    },
    onSuccess: (code) => {
      setTotp(code)
      setTotpValid(null)
    },
  })

  const validateTotp = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      return completeTwoFactor(totp)
    },
    onSuccess: () => {
      setTotpValid(true)
    },
    onError: (error) => {
      setTotpValid(false)
      setValidationError(getErrorMessage(error))
    },
  })

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

        {currentUser?.twoFactorSet ? (
          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">2FA Enabled</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Enter a current code from your 2FA app.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">2FA Not Yet Set Up</h2>
            <p className="mt-1 text-sm text-zinc-400">
              If you have your secret from setup, enter it below to generate a code. Otherwise, go back and complete setup first.
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-zinc-800 p-4">
          <h2 className="font-semibold">Enter TOTP Code</h2>
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

          {!twoFactorSecret && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-300">
                Enter Secret
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                placeholder="Paste your base32 secret here"
                value={manualSecret}
                onChange={(e) => setManualSecret(e.target.value)}
              />
            </div>
          )}

          <div className="mt-4 flex justify-center gap-3">
            <button
              className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => generateCode.mutate()}
              disabled={!activeSecret || generateCode.isPending}
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
              {validationError || "Invalid or expired TOTP code."}
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
          onClick={logout}
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}
