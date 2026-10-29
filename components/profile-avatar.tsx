export function ProfileAvatar({ name, avatarPath }: { name: string; avatarPath?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase() || 'P'
  return <div className="profile-portrait">
    {avatarPath ? <img src={`/api/profile/avatar?v=${encodeURIComponent(avatarPath)}`} width={96} height={96} alt={`${name}'s avatar`} /> : <span role="img" aria-label={`${name}'s avatar`}>{initials}</span>}
  </div>
}
