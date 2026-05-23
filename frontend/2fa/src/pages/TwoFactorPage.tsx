import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { QRCodeSVG } from "qrcode.react"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { useAuth } from "@/context/AuthContext"
import { createTwoFactorKey, getDebugTotpCode } from "@/lib/api"
import { getErrorMessage } from "@/lib/utils"

export function TwoFactorPage() {
  const {
    currentUser,
    setupToken,
    completeTwoFactor,
    logout,
    setChallengeToken,
  } = useAuth()

  const [totp, setTotp] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [totpValid, setTotpValid] = useState<boolean | null>(null)
  const [validationError, setValidationError] = useState("")

  const createSecret = useMutation({
    mutationFn: () => {
      if (currentUser === null) throw new Error("No current user")
      if (currentUser.twoFactorSet) {
        throw new Error("This user already has 2FA set.")
      }
      if (setupToken === null) {
        throw new Error("Missing 2FA setup token. Please log in again.")
      }
      return createTwoFactorKey(setupToken)
    },
    onSuccess: (response) => {
      setTotpUri(response.uri)
      setChallengeToken(response.challenge_token)
      const parsedUri = response.uri.replace("otpauth://", "https://")
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

        {!currentUser?.twoFactorSet && (
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

        {!currentUser?.twoFactorSet && (
          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Step 2: Create 2FA secret</h2>
            <button
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => createSecret.mutate()}
              disabled={
                !currentUser || setupToken === null || createSecret.isPending
              }
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
        )}

        {currentUser?.twoFactorSet && (
          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Step 2: 2FA already set</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Continue by entering a current code from your 2FA app.
            </p>
          </div>
        )}

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
