export function ProfileAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase() || 'P'
  return <div className="profile-portrait">
    <span role="img" aria-label={`${name}'s avatar`}>{initials}</span>
  </div>
}
