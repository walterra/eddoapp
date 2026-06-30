import { getSystemTimeZone } from '@eddo/core-client';
import { createContext, type ReactNode, useContext } from 'react';

const UserTimeZoneContext = createContext<string | null>(null);

interface UserTimeZoneProviderProps {
  children: ReactNode;
  timeZone?: string;
}

/** Provides the current user's timezone to todo components. */
export function UserTimeZoneProvider({ children, timeZone }: UserTimeZoneProviderProps) {
  return (
    <UserTimeZoneContext.Provider value={timeZone ?? getSystemTimeZone()}>
      {children}
    </UserTimeZoneContext.Provider>
  );
}

/** Returns the user timezone or browser timezone fallback. */
export function useUserTimeZone(): string {
  return useContext(UserTimeZoneContext) ?? getSystemTimeZone();
}
