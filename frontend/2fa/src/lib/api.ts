const API_BASE_URL = "http://127.0.0.1:8000"

export type UserRole = "admin" | "user"

type TokenResponse = {
  access_token: string
  token_type: string
}

export type LoginResponse = {
  user_id: number
  username: string
  two_factor_set: boolean
  setup_token: string | null
  challenge_token: string | null
  token_type: string
}

export type UserResponse = {
  id: number
  username: string
  role: UserRole
}

export type AdminUserResponse = UserResponse & {
  hashed_email: string
  two_factor_set: boolean
}

export type CreateUserRequest = {
  username: string
  email: string
  password: string
}

type CreateKeyResponse = {
  uri: string
  challenge_token: string
}

type DebugTotpResponse = {
  totp_code: number
}

export type ValidateTwoFactorResponse = {
  user: UserResponse
  token: TokenResponse
}

export async function completeChessLoginCallback(
  callbackUrl: string,
  state: string,
  user: UserResponse,
) {
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state,
      user_id: user.id,
      username: user.username,
      role: user.role,
    }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as LoginResponse
}

export async function createUser(user: CreateUserRequest) {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as UserResponse
}

export async function getAdminUsers(accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as AdminUserResponse[]
}

export async function updateUserRole(
  userId: number,
  role: UserRole,
  accessToken: string,
) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as UserResponse
}

export async function deleteUser(userId: number, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as boolean
}

export async function createDebugUser(user: CreateUserRequest) {
  const response = await fetch(`${API_BASE_URL}/DEBUG_CREATE_USER`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as UserResponse
}

export async function resetUserTwoFactor(userId: number, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/2fa`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as UserResponse
}

export async function getDebugTotpCode(userId: number) {
  const response = await fetch(`${API_BASE_URL}/DEBUG_get_2fa_key?user_id=${userId}`)

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const data: DebugTotpResponse = await response.json()
  return data.totp_code.toString().padStart(6, "0")
}


async function getErrorMessage(response: Response) {
  const errorText = await response.text()

  try {
    const errorData = JSON.parse(errorText)
    const detail = errorData.detail
    if (Array.isArray(detail)) {
      return detail.map((item: { msg: string }) => item.msg).join(", ")
    }
    return formatErrorMessage(detail || errorText)
  } catch {
    return formatErrorMessage(errorText || "Request failed")
  }
}

function formatErrorMessage(message: string) {
  if (message === "Failed to fetch") {
    return "Cannot connect to the backend. Please check that the backend server is running."
  }

  if (message.includes("User already has a two factor secret")) {
    return "This user already has a 2FA secret. You can continue to generate and validate a code."
  }

  if (message.includes("Invalid two factor code")) {
    return "Invalid 2FA code. Please generate a new code and validate it within 15 seconds."
  }

  return message
}

// Temporary helper for local development.
// This gets an admin JWT from the backend debug endpoint.
export async function getDebugAdminToken() {
  const response = await fetch(`${API_BASE_URL}/DEBUG_ADMIN_TOKEN`, {
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const data: TokenResponse = await response.json()
  return data.access_token
}

// Create the TOTP setup URI for a selected user.
export async function createTwoFactorKey(setupToken: string) {
  const response = await fetch(`${API_BASE_URL}/create_key`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${setupToken}`,
    },
  })

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        "This user already has a 2FA secret. You can continue to generate and validate a code."
      )
    }

    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as CreateKeyResponse
}

export async function validateTwoFactorCode(
  userTotp: string,
  challengeToken: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/validate_2fa_key?user_totp=${userTotp}`,
    {
      headers: {
        Authorization: `Bearer ${challengeToken}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as ValidateTwoFactorResponse
}
