import type { Dispatch, SetStateAction, SyntheticEvent } from "react"

type LoginPageProps = {
  loginEmail: string
  loginPassword: string
  loginError: string
  setLoginEmail: Dispatch<SetStateAction<string>>
  setLoginPassword: Dispatch<SetStateAction<string>>
  handleLogin: (event: SyntheticEvent<HTMLFormElement>) => void
}

// I moved the login UI into a separate component to keep App.tsx shorter.
// The actual login checking still happens in App.tsx because it needs access
// to the current user list and page state.
export function LoginPage({
  loginEmail,
  loginPassword,
  loginError,
  setLoginEmail,
  setLoginPassword,
  handleLogin,
}: LoginPageProps) {
  return (
    <div className="flex min-h-svh min-w-svw items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Login to 2FA Chess System</h1>

        <p className="mt-2 text-sm text-zinc-400">
          Please sign in with your account first. If the password is correct and
          2FA is set, you will continue to the verification step.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleLogin}>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="admin123"
            />
          </div>

          {loginError && (
            <div className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
              {loginError}
            </div>
          )}

          <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
            Login
          </button>
        </form>

        {/* These demo accounts make it easier to test the assignment locally. */}
        <div className="mt-6 rounded-lg bg-zinc-950 p-4 text-sm text-zinc-400">
          <p>Admin test: admin@example.com / admin123</p>
          <p>Normal user test account: user@example.com / user123</p>
        </div>
      </div>
    </div>
  )
}
