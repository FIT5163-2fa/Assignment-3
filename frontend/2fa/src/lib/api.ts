const API_BASE_URL = "http://127.0.0.1:8000"

type TokenResponse = {
  access_token: string
  token_type: string
}

type CreateKeyResponse = {
  uri: string
}

type DebugTotpResponse = {
  totp_code: number
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
    return formatErrorMessage(errorData.detail || errorText)
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
export async function createTwoFactorKey(userId: number) {
  const response = await fetch(`${API_BASE_URL}/create_key?user_id=${userId}`, {
    method: "POST",
  })

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        "This user already has a 2FA secret. You can continue to generate and validate a code."
      )
    }

    throw new Error(await getErrorMessage(response))
  }

  const data: CreateKeyResponse = await response.json()
  return data.uri
}

// This is kept separate because the backend validation endpoint is still being checked.
export async function validateTwoFactorCode(userId: number, userTotp: string) {
  const response = await fetch(
    `${API_BASE_URL}/validate_2fa_key?user_id=${userId}&user_totp=${userTotp}`,
  )

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const data: TokenResponse = await response.json()
  return data.access_token
}