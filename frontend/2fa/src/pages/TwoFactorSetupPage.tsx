import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation } from "@tanstack/react-query"
import { QRCodeSVG } from "qrcode.react"
import { useAuth } from "@/context/AuthContext"
import { createTwoFactorKey } from "@/lib/api"

export function TwoFactorSetupPage() {
  const { currentUser, setupToken, setTwoFactorSecret, setValidateToken } =
    useAuth()
  const navigate = useNavigate()

  const [secret, setSecret] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)

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
    onSuccess: ({ uri, validate_token }) => {
      setTotpUri(uri)
      setValidateToken(validate_token)
      console.log("Received TOTP URI:", uri)
      const parsedUri = uri.replace("otpauth://", "https://")
      const parsedUrl = new URL(parsedUri)
      const secretParam = parsedUrl.searchParams.get("secret")
      if (secretParam) {
        setSecret(secretParam)
        setTwoFactorSecret(secretParam)
      }
    },
  })

  return (
    <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Two-Factor Setup</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Current user:{" "}
          <span className="font-semibold text-white">
            {currentUser?.username}
          </span>{" "}
          ({currentUser?.role})
        </p>

        {currentUser && (
          <div className="mt-4 rounded-xl border border-zinc-800 p-4">
            <h2 className="font-semibold">Current User Details</h2>
            <dl className="mt-3 grid grid-cols-[120px_1fr] gap-2 text-sm">
              <dt className="text-zinc-400">User ID</dt>
              <dd>{currentUser.id}</dd>
              <dt className="text-zinc-400">Username</dt>
              <dd>{currentUser.username}</dd>
              <dt className="text-zinc-400">Email</dt>
              <dd>{currentUser.email}</dd>
              <dt className="text-zinc-400">2FA Set</dt>
              <dd>{currentUser.twoFactorSet ? "Yes" : "No"}</dd>
            </dl>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-zinc-800 p-4">
          <h2 className="font-semibold">Step 1: Create 2FA Secret</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Password accepted. This account needs a 2FA secret before
            verification.
          </p>
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

        <div className="mt-4 flex gap-3">
          <button
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
            onClick={() => navigate("/2fa")}
            disabled={!secret}
          >
            Continue to Verification
          </button>

          <button
            className="flex-1 rounded-lg bg-zinc-700 px-4 py-2 text-white"
            onClick={() => {
              setTwoFactorSecret(null)
              navigate("/login")
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
