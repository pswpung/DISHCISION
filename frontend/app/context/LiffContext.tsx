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
  bypassLiff: () => void;
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
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2008419367-SeVLxzHP';
        await liff.init({ liffId });
        setLiffObject(liff);
        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const userProfile = await liff.getProfile();
          setProfile(userProfile);
        }

        // Handle liff.state redirect ONLY after successful LIFF initialization
        // This ensures the SDK has processed the auth parameters and saved the login state/token before we redirect.
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const liffState = searchParams.get('liff.state');
          if (liffState) {
            const decodedPath = decodeURIComponent(liffState);
            if (decodedPath.startsWith('/')) {
              window.location.replace(window.location.origin + decodedPath);
              return;
            }
          }
        }
      } catch (err: any) {
        console.error('LIFF Init Error:', err);
        setError(err.toString());
        // Mock for local dev if LIFF fails (e.g. not in LINE browser)
        if (process.env.NODE_ENV === 'development') {
          console.log("Mocking LIFF for development");
          const urlParams = new URLSearchParams(window.location.search);
          const urlUserId = urlParams.get('user_id');
          if (urlUserId) {
            setIsLoggedIn(true);
            setProfile({
              userId: urlUserId,
              displayName: `Mock (${urlUserId.substring(0, 8)})`,
              pictureUrl: 'https://via.placeholder.com/150'
            });
          } else {
            console.log("No user_id found in URL. Staying logged out until bypassed.");
          }
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

  const bypassLiff = () => {
    console.log("Bypassing LIFF validation - using mock profile");
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    let urlUserId = urlParams?.get('user_id');
    
    if (!urlUserId) {
      const userInput = window.prompt("Enter a mock LINE User ID (e.g. U123456) to bypass LINE validation:");
      if (!userInput || userInput.trim() === "") {
        alert("A valid user ID is required to bypass LINE validation.");
        return;
      }
      urlUserId = userInput.trim();
    }
    
    setIsLoggedIn(true);
    setProfile({
      userId: urlUserId,
      displayName: `Mock (${urlUserId.substring(0, 8)})`,
      pictureUrl: 'https://via.placeholder.com/150'
    });
    setError(null);
    setLiffObject({
      closeWindow: () => {
        if (typeof window !== 'undefined') window.close();
      },
      login: () => { },
      logout: () => { },
      isLoggedIn: () => true,
      getProfile: () => Promise.resolve({
        userId: urlUserId,
        displayName: `Mock (${urlUserId.substring(0, 8)})`,
        pictureUrl: 'https://via.placeholder.com/150'
      }),
    } as any);
  };

  return (
    <LiffContext.Provider value={{ liffObject, isLoggedIn, profile, error, login, logout, bypassLiff }}>
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
