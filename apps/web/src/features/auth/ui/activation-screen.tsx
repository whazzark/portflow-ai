import { Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { Brand } from '@/components/brand/brand'
import { Button, buttonVariants } from '@/components/ui/button'
import type { SessionUser } from '@/features/auth/context/session-context'
import { useSession } from '@/features/auth/context/use-session'
import { isActivationLinkUnusableError } from '@/features/auth/mutations/use-invitation-acceptance'
import { useLogout } from '@/features/auth/mutations/use-logout'
import { useActivationPreview } from '@/features/auth/queries/use-activation-preview'
import { ActivationForm } from '@/features/auth/ui/activation-form'
import { parseApiError } from '@/libraries/tuyau/api-error'

export function ActivationScreen({ token }: { token: string }) {
  const session = useSession()
  const preview = useActivationPreview(token)
  // Set from the acceptance answer, so a link that dies between opening and submitting lands on the
  // same state as one that was dead from the start.
  const [isUnusable, setIsUnusable] = useState(false)
  const [isActivatedWithoutSession, setIsActivatedWithoutSession] = useState(false)

  if (isActivatedWithoutSession) {
    return (
      <ActivationPanel
        title="Activation complete"
        description="Your access is active. Log in with the password you just chose."
      >
        <LogInLink />
      </ActivationPanel>
    )
  }

  if (isUnusable || (preview.isError && isActivationLinkUnusableError(preview.error))) {
    return <UnusableLink />
  }

  if (preview.isError) {
    return (
      <ActivationPanel
        title="Activate your access"
        description="We couldn't check this activation link."
      >
        <Button
          className="h-10 w-full"
          disabled={preview.isFetching}
          onClick={() => void preview.refetch()}
          size="lg"
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      </ActivationPanel>
    )
  }

  // Nothing to act on until the link is known to be usable; the split-screen surface is already up.
  if (!preview.isSuccess) {
    return null
  }

  const { firstName, lastName, email } = preview.data.data

  // A browser holding a session never gets the form — typically the inviting administrator opening
  // the link they just copied, who would otherwise choose the invited person's password. The API
  // refuses such an acceptance anyway; this is the courtesy that explains why.
  if (session.status === 'authenticated') {
    return (
      <ActivationPanel
        title="Activate your access"
        description={`This link activates the access of ${firstName} ${lastName}.`}
      >
        <SignedInNotice user={session.user} />
      </ActivationPanel>
    )
  }

  return (
    <ActivationPanel
      title="Activate your access"
      description={`This link activates the access of ${firstName} ${lastName}. Choose the password you will log in with.`}
    >
      <ActivationForm
        email={email}
        onActivatedWithoutSession={() => setIsActivatedWithoutSession(true)}
        onUnusable={() => setIsUnusable(true)}
        token={token}
      />
    </ActivationPanel>
  )
}

/**
 * Logging out ends that browser's session exactly as it does everywhere else, and keeps the person
 * on this link: `useLogout` re-reads the session without navigating, and the form takes this place.
 */
function SignedInNotice({ user }: { user: SessionUser }) {
  const logout = useLogout()

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-7">
        You're logged in as {user.firstName} {user.lastName}. Log out to continue with this
        activation.
      </p>
      <Button
        className="h-10 w-full"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(
            {},
            {
              onError: (error) => {
                toast.error('Unable to log out', { description: parseApiError(error).message })
              },
            },
          )
        }
        size="lg"
        type="button"
        variant="outline"
      >
        {logout.isPending ? 'Logging out…' : 'Log out'}
      </Button>
    </div>
  )
}

/**
 * One outcome for every reason, and no name or email: telling "expired" from "already used" would
 * tell whoever holds a stale link what became of the access. Both next steps fit in one message.
 */
function UnusableLink() {
  return (
    <ActivationPanel
      title="This activation link can't be used"
      description="If you've already activated your access, log in with your password. Otherwise, ask an organization admin for a new link."
    >
      <LogInLink />
    </ActivationPanel>
  )
}

function LogInLink() {
  return (
    <Link className={buttonVariants({ className: 'h-10 w-full', size: 'lg' })} to="/login">
      Log in
    </Link>
  )
}

function ActivationPanel({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: ReactNode
  title: string
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-7">
        <Brand
          tone="inverse"
          className="font-mono text-primary text-xs uppercase tracking-[0.16em]"
        />
        <h1 className="mt-7 font-semibold text-3xl leading-tight tracking-tight">{title}</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-7">{description}</p>
      </div>
      {children}
    </div>
  )
}
