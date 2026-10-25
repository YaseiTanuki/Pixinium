// Neon stores member (displayed as User) and admin. Unknown/future roles fail closed.
export type Permission = 'admin:access' | 'assets:upload'
const permissions: Record<string, readonly Permission[]> = {
  member: [],
  admin: ['admin:access', 'assets:upload'],
}

export function hasPermission(role: string, permission: Permission): boolean {
  return Object.hasOwn(permissions, role) && permissions[role].includes(permission)
}
