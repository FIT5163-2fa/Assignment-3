import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function App() {
  const [totp, setTotp] = useState("")
  const queryClient = useQueryClient()

  const validateTotp = useQuery({ queryKey: ['todos'], queryFn: getTodos })

  return (
    <div className="flex min-h-svh min-w-svw flex-col items-center justify-center p-6">
      <div>Enter TOTP</div>

      <InputOTP maxLength={6} value={totp} onChange={setTotp}>
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
  )
}

export default App
