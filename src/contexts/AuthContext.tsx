"use client";

/**
 * Auth Context - Authentication and user session management
 * 
 * This context provides authentication functionality using NextAuth with Google OAuth,
 * while ensuring the platform works fully without authentication.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, signIn, signOut, SessionProvider } from 'next-auth/react';
import { useError } from './ErrorContext';

// User preferences type
export interface UserPreferences {
  darkMode?: boolean;
  notificationsEnabled?: boolean;
  defaultChunkSize?: number;
}

// Transfer history item type
export interface TransferHistoryItem {
  id: string;
  timestamp: Date;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'sent' | 'received';
  recipientOrSender?: string;
  completed: boolean;
}

// Auth context type
export interface AuthContextType {
  // Authentication
  isAuthenticated: boolean;
  user: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
  } | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  
  // User preferences
  preferences: UserPreferences;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => Promise<void>;
  
  // Transfer history
  transferHistory: TransferHistoryItem[];
  addTransferToHistory: (transfer: Omit<TransferHistoryItem, 'id' | 'timestamp'>) => Promise<void>;
  clearTransferHistory: () => Promise<void>;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  logout: async () => {},
  preferences: {},
  updatePreferences: async () => {},
  transferHistory: [],
  addTransferToHistory: async () => {},
  clearTransferHistory: async () => {}
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: session } = useSession();
  const { showToast } = useError();
  
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  
  // Load user preferences and history from local storage when authenticated
  useEffect(() => {
    if (session?.user?.email) {
      // Load preferences
      const storedPreferences = localStorage.getItem(`preferences_${session.user.email}`);
      if (storedPreferences) {
        try {
          setPreferences(JSON.parse(storedPreferences));
        } catch (error) {
          console.error('Failed to parse stored preferences:', error);
        }
      }
      
      // Load transfer history
      const storedHistory = localStorage.getItem(`history_${session.user.email}`);
      if (storedHistory) {
        try {
          const parsedHistory = JSON.parse(storedHistory);
          // Convert string dates back to Date objects
          const historyWithDates = parsedHistory.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }));
          setTransferHistory(historyWithDates);
        } catch (error) {
          console.error('Failed to parse stored transfer history:', error);
        }
      }
    }
  }, [session?.user?.email]);
  
  // Save preferences to local storage when they change
  useEffect(() => {
    if (session?.user?.email && Object.keys(preferences).length > 0) {
      localStorage.setItem(`preferences_${session.user.email}`, JSON.stringify(preferences));
    }
  }, [preferences, session?.user?.email]);
  
  // Save transfer history to local storage when it changes
  useEffect(() => {
    if (session?.user?.email && transferHistory.length > 0) {
      localStorage.setItem(`history_${session.user.email}`, JSON.stringify(transferHistory));
    }
  }, [transferHistory, session?.user?.email]);
  
  // Login with Google
  const login = async () => {
    try {
      await signIn('google', { callbackUrl: window.location.href });
    } catch (error) {
      console.error('Login failed:', error);
      showToast('Failed to sign in with Google. Please try again.', 'error');
    }
  };
  
  // Logout
  const logout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Logout failed:', error);
      showToast('Failed to sign out. Please try again.', 'error');
    }
  };
  
  // Update user preferences
  const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
    if (!session?.user?.email) {
      showToast('You need to be signed in to save preferences.', 'info');
      return;
    }
    
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      setPreferences(updatedPreferences);
      showToast('Preferences updated successfully.', 'success');
    } catch (error) {
      console.error('Failed to update preferences:', error);
      showToast('Failed to update preferences. Please try again.', 'error');
    }
  };
  
  // Add transfer to history
  const addTransferToHistory = async (transfer: Omit<TransferHistoryItem, 'id' | 'timestamp'>) => {
    if (!session?.user?.email) {
      // Don't show a toast here as this is optional functionality
      return;
    }
    
    try {
      const newTransfer: TransferHistoryItem = {
        ...transfer,
        id: `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date()
      };
      
      setTransferHistory(prev => [newTransfer, ...prev].slice(0, 50)); // Keep only the last 50 transfers
    } catch (error) {
      console.error('Failed to add transfer to history:', error);
      // Don't show a toast for this as it's not critical
    }
  };
  
  // Clear transfer history
  const clearTransferHistory = async () => {
    if (!session?.user?.email) {
      showToast('You need to be signed in to manage transfer history.', 'info');
      return;
    }
    
    try {
      setTransferHistory([]);
      localStorage.removeItem(`history_${session.user.email}`);
      showToast('Transfer history cleared successfully.', 'success');
    } catch (error) {
      console.error('Failed to clear transfer history:', error);
      showToast('Failed to clear transfer history. Please try again.', 'error');
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        user: session?.user ?? null,
        login,
        logout,
        preferences,
        updatePreferences,
        transferHistory,
        addTransferToHistory,
        clearTransferHistory
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Wrapper component that includes SessionProvider
export const AuthProviderWithSession: React.FC<AuthProviderProps> = ({ children }) => {
  return (
    <SessionProvider>
      <AuthProvider>{children}</AuthProvider>
    </SessionProvider>
  );
};