import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/mutations/use-logout'
import { GuestCard } from '@/features/auth/ui/guest-card'
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
    // Says what is required and what it replaces, and deliberately not *why*: naming the
    // administrative action behind the requirement would disclose it (FR-019).
    <GuestCard
      title="Choose a new password"
      description="You must choose a new password before you can use Portflow. This replaces the password you signed in with."
    >
      <PasswordRenewalForm />

      {/* `UserMenu` itself cannot be reused — it lives in the sidebar, and nothing of the shell
          renders here — but the logout mutation and its confirmation are the delivered ones, so
          leaving from the renewal step behaves exactly as it does everywhere else. A user who
          cannot choose a password right now must still be able to leave the session (FR-019). */}
      <div className="flex justify-center">
        <Button
          className="text-muted-foreground"
          onClick={openLogoutConfirmation}
          size="lg"
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
    </GuestCard>
  )
}
