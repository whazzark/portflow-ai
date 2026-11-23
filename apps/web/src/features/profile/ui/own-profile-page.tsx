import { getRouteApi } from '@tanstack/react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { OwnPasswordForm } from '@/features/profile/ui/own-password-form'
import { OwnProfileForm } from '@/features/profile/ui/own-profile-form'
import { formatFullName, getInitials } from '@/features/users/helpers/name'
import { USER_ROLE_LABELS } from '@/features/users/helpers/user-labels'

const profileRoute = getRouteApi('/_authenticated/profile')

type ProfileTab = 'identity' | 'password'

export function OwnProfilePage() {
  const user = useAuthenticatedUser()
  const { tab } = profileRoute.useSearch()
  const navigate = profileRoute.useNavigate()

  function updateTab(nextTab: ProfileTab) {
    void navigate({ search: (previous) => ({ ...previous, tab: nextTab }) })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:px-8 md:py-7">
      {/* Sr-only, as on every other page: the header's breadcrumb already names the page. */}
      <h1 className="sr-only">Profile</h1>

      <div className="flex items-center gap-4.5">
        <Avatar aria-hidden={true} className="size-16 after:border-0">
          <AvatarFallback className="bg-muted font-semibold text-foreground">
            {getInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="break-words font-semibold text-[22px] leading-tight">
            {formatFullName(user)}
          </h2>
          <p className="break-words text-muted-foreground text-sm">
            {user.email} · {USER_ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>

      <Tabs className="gap-6" onValueChange={updateTab} value={tab}>
        <TabsList
          aria-label="Profile"
          className="h-10! w-full justify-start gap-6 border-b"
          variant="line"
        >
          <TabsTrigger className="flex-none px-1 data-active:font-semibold" value="identity">
            Identity
          </TabsTrigger>
          <TabsTrigger className="flex-none px-1 data-active:font-semibold" value="password">
            Password
          </TabsTrigger>
        </TabsList>

        {/* Both kept mounted, as when the two forms sat side by side: switching tab keeps a draft,
            and the identity form keeps watching for an address an administrator moves. */}
        <TabsContent keepMounted={true} value="identity">
          <section className="flex w-full max-w-[520px] flex-col gap-5.5">
            <p className="text-muted-foreground text-sm leading-[22px]">
              Your name as it appears to the rest of the organization, and the email address you
              sign in with.
            </p>
            {/* Keyed on the user alone: a session refreshed under the form — after an accepted
                update, or an address an administrator moved — must not wipe what is being typed. */}
            <OwnProfileForm key={user.id} user={user} />
          </section>
        </TabsContent>

        <TabsContent keepMounted={true} value="password">
          <section className="flex w-full max-w-[520px] flex-col gap-5.5">
            <p className="text-muted-foreground text-sm leading-[22px]">
              Changing it keeps you signed in here and ends every other connection you had left
              remembered.
            </p>
            <OwnPasswordForm />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
