import { Separator } from '@/components/ui/separator'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { OwnPasswordForm } from '@/features/profile/ui/own-password-form'
import { OwnProfileForm } from '@/features/profile/ui/own-profile-form'

export function OwnProfilePage() {
  const user = useAuthenticatedUser()

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
      {/* Sr-only, as on every other page: the header's breadcrumb already names the page. */}
      <h1 className="sr-only">Profile</h1>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-lg">Identity</h2>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Your name as it appears to the rest of the organization, and the email address you sign
            in with.
          </p>
        </div>
        <div className="w-full max-w-md">
          {/* Keyed on the user alone: a session refreshed under the form — after an accepted update,
              or an address an administrator moved — must not wipe what is being typed. */}
          <OwnProfileForm key={user.id} user={user} />
        </div>
      </section>

      <Separator className="max-w-2xl" />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-lg">Password</h2>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Changing it keeps you signed in here and ends every other connection you had left
            remembered.
          </p>
        </div>
        <div className="w-full max-w-md">
          <OwnPasswordForm />
        </div>
      </section>
    </div>
  )
}
