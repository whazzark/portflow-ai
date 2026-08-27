import { useState } from 'react'
import { toast } from 'sonner'
import { Brand } from '@/components/brand/brand'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/mutations/use-logout'
import { LogOutConfirmation } from '@/features/auth/ui/log-out-confirmation'
import { PasswordRenewalForm } from '@/features/auth/ui/password-renewal-form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export function PasswordRenewalScreen() {
  const logout = useLogout()
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)

  function openLogoutConfirmation() {
    logout.reset()
    setIsConfirmationOpen(true)
  }

  function handleConfirmationOpenChange(open: boolean) {
    if (logout.isPending) {
      return
    }

    setIsConfirmationOpen(open)

    if (!open) {
      logout.reset()
    }
  }

  function confirmLogout() {
    logout.mutate(
      {},
      {
        onError: (error) => {
          toast.error('Unable to log out', { description: parseApiError(error).message })
        },
      },
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-7">
        <Brand
          tone="inverse"
          className="font-mono text-primary text-xs uppercase tracking-[0.16em]"
        />
        <h1 className="mt-7 font-semibold text-3xl leading-tight tracking-tight">
          Choose a new password
        </h1>
        {/* Says what is required and what it replaces, and deliberately not *why*: naming the
            administrative action behind the requirement would disclose it (FR-019). */}
        <p className="mt-3 text-muted-foreground text-sm leading-7">
          You must choose a new password before you can use Portflow. This replaces the password you
          signed in with.
        </p>
      </div>
      <PasswordRenewalForm />

      {/* `UserMenu` itself cannot be reused — it lives in the sidebar, and nothing of the shell
          renders here — but the logout mutation and its confirmation are the delivered ones, so
          leaving from the renewal step behaves exactly as it does everywhere else. A user who
          cannot choose a password right now must still be able to leave the session (FR-019). */}
      <div className="mt-6 text-center">
        <Button
          className="text-muted-foreground"
          onClick={openLogoutConfirmation}
          size="sm"
          type="button"
          variant="ghost"
        >
          Log out
        </Button>
      </div>

      <LogOutConfirmation
        isPending={logout.isPending}
        onConfirm={confirmLogout}
        onOpenChange={handleConfirmationOpenChange}
        open={isConfirmationOpen}
      />
    </div>
  )
}
