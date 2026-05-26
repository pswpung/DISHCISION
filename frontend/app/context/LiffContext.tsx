'use client'
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import liff from '@line/liff';

interface LiffContextType {
  liffObject: typeof liff | null;
  isLoggedIn: boolean;
  profile: any | null;
  error: string | null;
  login: () => void;
  logout: () => void;
}

const LiffContext = createContext<LiffContextType | undefined>(undefined);

export const LiffProvider = ({ children }: { children: ReactNode }) => {
  const [liffObject, setLiffObject] = useState<typeof liff | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // LIFF SDK rejections can bubble up as standard Event objects in local development
      if (
        event.reason &&
        (event.reason instanceof Event ||
         event.reason.toString() === '[object Event]' ||
         (event.reason.message && event.reason.message.includes('LIFF')))
      ) {
        console.warn('Suppressed unhandled rejection (likely LIFF SDK internal load failure):', event.reason);
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2010074250-9aD5NH9x';
        await liff.init({ liffId });
        setLiffObject(liff);
        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
        }
      } catch (err: any) {
        console.error('LIFF Init Error:', err);
        setError(err.toString());
        // Mock for local dev if LIFF fails (e.g. not in LINE browser)
        if (process.env.NODE_ENV === 'development') {
          console.log("Mocking LIFF for development");
          setIsLoggedIn(true);
          setProfile({
            userId: 'mock-user-id',
            displayName: 'Mock User',
            pictureUrl: 'https://via.placeholder.com/150'
          });
        }
      }
    };

    initLiff();
  }, []);

  const login = () => {
    if (liffObject && !isLoggedIn) {
      // Explicitly set redirectUri to current full URL to preserve query params (group_id, user_id)
      liffObject.login({ redirectUri: window.location.href });
    }
  };

  const logout = () => {
    if (liffObject && isLoggedIn) {
      liffObject.logout();
      setIsLoggedIn(false);
      setProfile(null);
    }
  };

  return (
    <LiffContext.Provider value={{ liffObject, isLoggedIn, profile, error, login, logout }}>
      {children}
    </LiffContext.Provider>
  );
};

export const useLiff = () => {
  const context = useContext(LiffContext);
  if (context === undefined) {
    throw new Error('useLaiff must be used within a LiffProvider');
  }
  return context;
};
