// This import makes the file a module, turning the declare blocks below
// into augmentations (extending existing types) rather than replacements.
import type { DefaultSession } from 'next-auth'

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: Role
    } & DefaultSession['user']
  }

  interface User {
    role: Role
  }
}
