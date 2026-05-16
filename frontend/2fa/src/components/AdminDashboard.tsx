import type { Dispatch, SetStateAction, SyntheticEvent } from "react"

type UserRole = "admin" | "user"

type DemoUser = {
  id: number
  username: string
  email: string
  password: string
  role: UserRole
  keygenEnabled: boolean
}

type AdminDashboardProps = {
  users: DemoUser[]
  newUsername: string
  newEmail: string
  newPassword: string
  newRole: UserRole
  setNewUsername: Dispatch<SetStateAction<string>>
  setNewEmail: Dispatch<SetStateAction<string>>
  setNewPassword: Dispatch<SetStateAction<string>>
  setNewRole: Dispatch<SetStateAction<UserRole>>
  handleAddUser: (event: SyntheticEvent<HTMLFormElement>) => void
  handleToggleKeygen: (userId: number) => void
  handleDeleteUser: (userId: number) => void
  handleLogout: () => void
}

// I moved the admin UI into its own component so App.tsx is easier to read.
// The user data and functions are still passed from App.tsx because the main
// application state is stored there.
export function AdminDashboard({
  users,
  newUsername,
  newEmail,
  newPassword,
  newRole,
  setNewUsername,
  setNewEmail,
  setNewPassword,
  setNewRole,
  handleAddUser,
  handleToggleKeygen,
  handleDeleteUser,
  handleLogout,
}: AdminDashboardProps) {
  return (
    <div className="min-h-svh min-w-svw bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Manage users and their keygen account status.
            </p>
          </div>

          <button
            className="rounded-lg bg-zinc-700 px-4 py-2 text-white"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        <form
          className="mt-8 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:grid-cols-5"
          onSubmit={handleAddUser}
        >
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="New username"
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
          />

          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Email"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />

          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />

          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>

          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            disabled={!newUsername.trim() || !newPassword.trim()}
          >
            Add User
          </button>
        </form>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-800 text-zinc-300">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Keygen Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((userItem) => (
                <tr key={userItem.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">{userItem.username}</td>
                  <td className="px-4 py-3">{userItem.role}</td>
                  <td className="px-4 py-3">
                    {userItem.keygenEnabled ? "Enabled" : "Disabled"}
                  </td>
                  <td className="flex gap-2 px-4 py-3">
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-white"
                      onClick={() => handleToggleKeygen(userItem.id)}
                    >
                      {userItem.keygenEnabled ? "Disable" : "Enable"}
                    </button>

                    <button
                      className="rounded-lg bg-red-600 px-3 py-1 text-white"
                      onClick={() => handleDeleteUser(userItem.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Short note to explain how the admin controls affect the login flow. */}
        <div className="mt-6 rounded-xl bg-zinc-900 p-4 text-sm text-zinc-400">
          The admin page is used to manage users and their keygen account
          status. If a keygen account is disabled, that user cannot continue to
          the 2FA verification step.
        </div>
      </div>
    </div>
  )
}
