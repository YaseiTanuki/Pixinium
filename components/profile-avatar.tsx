export function ProfileAvatar({ name, avatarPath }: { name: string; avatarPath?: string | null }) {
  return <div className="profile-portrait">
    <img src={avatarPath ? `/api/profile/avatar?v=${encodeURIComponent(avatarPath)}` : '/images/default-avatar.png'} width={96} height={96} alt={`${name}'s avatar`} />
  </div>
}
