'use client'

import { SessionProvider } from 'next-auth/react'

interface Props {
  children: React.ReactNode
}

export default function NextAuthProvider({ children }: Props) {
  return (
    <SessionProvider
      basePath="/api/auth"
      refetchOnWindowFocus={true}
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  )
}
