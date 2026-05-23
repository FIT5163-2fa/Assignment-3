import { useState, type SyntheticEvent } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "@/context/AuthContext"
import { getErrorMessage } from "@/lib/utils"

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    try {
      await login(email, password)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Login to 2FA Chess System</h1>

        <p className="mt-2 text-sm text-zinc-400">
          Please sign in with your account first. If the password is correct and
          2FA is set, you will continue to the verification step.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
            Login
          </button>
        </form>

        <button
          className="mt-4 w-full rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
          onClick={() => navigate("/register")}
        >
          Don&apos;t have an account? Register
        </button>

        <div className="mt-6 rounded-lg bg-zinc-950 p-4 text-sm text-zinc-400">
          <p>Admin test: admin@example.com / password</p>
          <p>Normal user test account: user@example.com / user1234</p>
        </div>
      </div>
    </div>
  )
}
