import { useState, type SyntheticEvent } from "react"
import { useNavigate } from "react-router"
import { createUser } from "@/lib/api"
import { getErrorMessage } from "@/lib/utils"

export function RegisterPage() {
  const navigate = useNavigate()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const trimmedUsername = username.trim()
    const trimmedEmail = email.trim()

    if (!trimmedUsername) {
      setError("Username cannot be empty.")
      return
    }

    if (!trimmedEmail) {
      setError("Email cannot be empty.")
      return
    }

    if (!password) {
      setError("Password cannot be empty.")
      return
    }

    try {
      await createUser({
        username: trimmedUsername,
        email: trimmedEmail,
        password,
      })
      setUsername("")
      setEmail("")
      setPassword("")
      navigate("/login")
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Register</h1>

        <p className="mt-2 text-sm text-zinc-400">
          Create a new account to get started with the 2FA Chess System.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">Username</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Choose a username"
            />
          </div>

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
            Register
          </button>
        </form>

        <button
          className="mt-4 w-full rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
          onClick={() => navigate("/login")}
        >
          Already have an account? Login
        </button>
      </div>
    </div>
  )
}
