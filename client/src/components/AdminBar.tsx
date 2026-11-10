import type { AdminUser } from '../types'

type Props = {
  admin: AdminUser
  newComments: number
  onComments: () => void
  onManageAdmins: () => void
  onChangePassword: () => void
  onSignOut: () => void
}

const barButton = 'shrink-0 cursor-pointer rounded-full px-3 py-1 text-[0.875rem] font-medium text-paper/90 transition-colors hover:bg-paper/15 hover:text-paper'

// A slim strip under the header while an admin is signed in
export function AdminBar({ admin, newComments, onComments, onManageAdmins, onChangePassword, onSignOut }: Props) {
  return (
    <div className="fixed inset-x-0 top-16 z-[29] bg-wine-deep text-paper shadow-[0_6px_16px_-10px_rgb(74_14_26_/_0.7)]">
      <div className="scrollbar-none mx-auto flex h-10 max-w-[88rem] items-center gap-1 overflow-x-auto px-4 sm:px-8">
        <span className="mr-2 shrink-0 text-[0.875rem] text-paper/80">
          Signed in as <span className="font-semibold text-paper">{admin.username}</span>
          {admin.role === 'owner' && <span className="text-paper/70"> (owner)</span>}
        </span>
        <button type="button" onClick={onComments} className={`${barButton} ml-auto inline-flex items-center gap-1.5 bg-paper/10`}>
          Comments to review
          <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[0.8125rem] ${newComments ? 'bg-gold-light text-wine-deep' : 'bg-paper/20 text-paper'}`}>
            {newComments}
          </span>
        </button>
        {admin.role === 'owner' && (
          <button type="button" onClick={onManageAdmins} className={barButton}>
            Manage admins
          </button>
        )}
        <button type="button" onClick={onChangePassword} className={barButton}>
          Change password
        </button>
        <button type="button" onClick={onSignOut} className={barButton}>
          Sign out
        </button>
      </div>
    </div>
  )
}
