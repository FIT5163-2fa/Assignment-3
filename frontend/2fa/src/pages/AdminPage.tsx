import { useState, type SyntheticEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/context/AuthContext"
import {
  getAdminUsers,
  createUser,
  updateUserRole,
  deleteUser,
  resetUserTwoFactor,
} from "@/lib/api"
import type { UserRole, AdminUserResponse } from "@/lib/api"
import { getErrorMessage } from "@/lib/utils"

function formatHashedEmail(hashedEmail: string) {
  if (!hashedEmail) return "Not loaded"
  if (hashedEmail.length <= 8) return hashedEmail
  return `${hashedEmail.slice(0, 4)}....${hashedEmail.slice(-4)}`
}

export function AdminPage() {
  const { currentUser, accessToken, logout } = useAuth()
  const queryClient = useQueryClient()

  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("password123")
  const [newRole, setNewRole] = useState<UserRole>("user")
  const [adminActionError, setAdminActionError] = useState("")

  const usersQuery = useQuery({
    queryKey: ["admin-users", accessToken],
    queryFn: () => {
      if (!accessToken) throw new Error("No access token")
      return getAdminUsers(accessToken)
    },
    enabled: accessToken !== null,
  })

  function refreshAdminUsers() {
    return queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  }

  async function handleAddUser(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setAdminActionError("")

    const trimmedUsername = newUsername.trim()
    const trimmedEmail = newEmail.trim()

    if (!trimmedUsername) {
      alert("Username cannot be empty.")
      return
    }

    if (!trimmedEmail) {
      alert("Email cannot be empty.")
      return
    }

    if (!accessToken) {
      alert("Admin token is missing. Please log in again.")
      return
    }

    try {
      const createdUser = await createUser({
        username: trimmedUsername,
        email: trimmedEmail,
        password: newPassword,
      })

      if (newRole !== createdUser.role) {
        await updateUserRole(createdUser.id, newRole, accessToken)
      }

      setNewUsername("")
      setNewEmail("")
      setNewPassword("password123")
      setNewRole("user")
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  async function handleResetTwoFactor(userId: number) {
    if (!accessToken) return
    setAdminActionError("")

    try {
      await resetUserTwoFactor(userId, accessToken)
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  async function handleUpdateRole(userId: number, role: UserRole) {
    if (!accessToken) return
    setAdminActionError("")

    try {
      await updateUserRole(userId, role, accessToken)
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!accessToken) return
    setAdminActionError("")
    const users = usersQuery.data
    const selectedUser = users?.find(
      (userItem) => userItem.id === userId,
    )

    if (selectedUser?.username === currentUser?.username) {
      setAdminActionError("The current admin account cannot be deleted here.")
      return
    }

    try {
      await deleteUser(userId, accessToken)
      await refreshAdminUsers()
    } catch (error) {
      setAdminActionError(getErrorMessage(error))
    }
  }

  const users: AdminUserResponse[] = usersQuery.data ?? []
  const adminCount = users.filter((u) => u.role === "admin").length

  return (
    <div className="min-h-svh min-w-svw bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Manage users and their 2FA setup status.
            </p>
          </div>

          <button
            className="rounded-lg bg-zinc-700 px-4 py-2 text-white"
            onClick={logout}
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
            disabled={
              !newUsername.trim() || !newEmail.trim() || !newPassword.trim()
            }
          >
            Add User
          </button>
        </form>

        {adminActionError && (
          <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            {adminActionError}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-800 text-zinc-300">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Hashed Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">2FA Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {usersQuery.isLoading && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-zinc-400"
                    colSpan={5}
                  >
                    Loading users...
                  </td>
                </tr>
              )}

              {!usersQuery.isLoading && usersQuery.error && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-red-400"
                    colSpan={5}
                  >
                    {usersQuery.error.message}
                  </td>
                </tr>
              )}

              {users.map((userItem) => (
                <tr key={userItem.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">{userItem.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {formatHashedEmail(userItem.hashed_email)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1"
                      value={userItem.role}
                      disabled={userItem.role === "admin" && adminCount <= 1}
                      title={
                        userItem.role === "admin" && adminCount <= 1
                          ? "Cannot demote the last admin"
                          : undefined
                      }
                      onChange={(event) =>
                        handleUpdateRole(
                          userItem.id,
                          event.target.value as UserRole,
                        )
                      }
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {userItem.two_factor_set ? "Set" : "Not set"}
                  </td>
                  <td className="flex gap-2 px-4 py-3">
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-white"
                      onClick={() => handleResetTwoFactor(userItem.id)}
                      disabled={!userItem.two_factor_set}
                    >
                      Reset 2FA
                    </button>

                    <button
                      className="rounded-lg bg-red-600 px-3 py-1 text-white disabled:opacity-50"
                      onClick={() => handleDeleteUser(userItem.id)}
                      disabled={userItem.role === "admin" && adminCount <= 1}
                      title={
                        userItem.role === "admin" && adminCount <= 1
                          ? "Cannot delete the last admin"
                          : undefined
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl bg-zinc-900 p-4 text-sm text-zinc-400">
          The admin page is used to manage users and their 2FA setup status.
          Resetting 2FA clears the user&apos;s secret so they can enroll again.
        </div>
      </div>
    </div>
  )
}
