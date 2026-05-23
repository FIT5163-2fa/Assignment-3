import { useAuth } from "@/context/AuthContext"

export function ChessPage() {
  const { isChessLogin, logout } = useAuth()

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
          onClick={logout}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
