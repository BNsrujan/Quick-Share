/**
 * Tests for AuthContext
 * 
 * This file contains tests for the authentication context functionality,
 * ensuring that authentication works properly and doesn't affect core functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { SessionProvider } from 'next-auth/react';

// Mock next-auth
jest.mock('next-auth/react', () => {
  const originalModule = jest.requireActual('next-auth/react');
  return {
    __esModule: true,
    ...originalModule,
    useSession: jest.fn(() => ({
      data: null,
      status: 'unauthenticated',
    })),
    signIn: jest.fn(),
    signOut: jest.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

// Mock ErrorContext
jest.mock('../ErrorContext', () => ({
  useError: () => ({
    showToast: jest.fn(),
  }),
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { isAuthenticated, user, login, logout, preferences, updatePreferences, transferHistory, addTransferToHistory, clearTransferHistory } = useAuth();
  
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-email">{user?.email || 'No user'}</div>
      <button data-testid="login-button" onClick={login}>Login</button>
      <button data-testid="logout-button" onClick={logout}>Logout</button>
      <button 
        data-testid="update-prefs-button" 
        onClick={() => updatePreferences({ darkMode: true })}
      >
        Update Preferences
      </button>
      <button 
        data-testid="add-transfer-button" 
        onClick={() => addTransferToHistory({
          fileName: 'test.txt',
          fileSize: 1024,
          fileType: 'text/plain',
          direction: 'sent',
          completed: true
        })}
      >
        Add Transfer
      </button>
      <button data-testid="clear-history-button" onClick={clearTransferHistory}>Clear History</button>
      <div data-testid="dark-mode">{preferences.darkMode ? 'Dark' : 'Light'}</div>
      <div data-testid="transfer-count">{transferHistory.length}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true
    });
  });
  
  it('provides authentication state and functions', () => {
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Initial state
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('Light');
    expect(screen.getByTestId('transfer-count')).toHaveTextContent('0');
    
    // Check that buttons are rendered
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    expect(screen.getByTestId('update-prefs-button')).toBeInTheDocument();
    expect(screen.getByTestId('add-transfer-button')).toBeInTheDocument();
    expect(screen.getByTestId('clear-history-button')).toBeInTheDocument();
  });
  
  it('calls signIn when login is called', async () => {
    const { signIn } = require('next-auth/react');
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Click login button
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Check that signIn was called
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: expect.any(String) });
  });
  
  it('calls signOut when logout is called', async () => {
    const { signOut } = require('next-auth/react');
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Click logout button
    fireEvent.click(screen.getByTestId('logout-button'));
    
    // Check that signOut was called
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
  
  it('handles authenticated state correctly', async () => {
    const { useSession } = require('next-auth/react');
    
    // Mock authenticated session
    useSession.mockReturnValue({
      data: {
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          image: 'https://example.com/avatar.jpg'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      status: 'authenticated'
    });
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Check authenticated state
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
  });
  
  it('loads preferences from localStorage when authenticated', async () => {
    const { useSession } = require('next-auth/react');
    const { getItem } = window.localStorage;
    
    // Mock authenticated session
    useSession.mockReturnValue({
      data: {
        user: {
          email: 'test@example.com'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      status: 'authenticated'
    });
    
    // Mock localStorage
    getItem.mockReturnValueOnce(JSON.stringify({ darkMode: true }));
    getItem.mockReturnValueOnce('[]');
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Check that preferences were loaded
    expect(getItem).toHaveBeenCalledWith('preferences_test@example.com');
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('Dark');
  });
  
  it('saves preferences to localStorage when updated', async () => {
    const { useSession } = require('next-auth/react');
    const { setItem } = window.localStorage;
    
    // Mock authenticated session
    useSession.mockReturnValue({
      data: {
        user: {
          email: 'test@example.com'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      status: 'authenticated'
    });
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Update preferences
    fireEvent.click(screen.getByTestId('update-prefs-button'));
    
    // Check that preferences were saved
    expect(setItem).toHaveBeenCalledWith('preferences_test@example.com', expect.any(String));
    expect(screen.getByTestId('dark-mode')).toHaveTextContent('Dark');
  });
  
  it('adds transfer to history when authenticated', async () => {
    const { useSession } = require('next-auth/react');
    const { setItem } = window.localStorage;
    
    // Mock authenticated session
    useSession.mockReturnValue({
      data: {
        user: {
          email: 'test@example.com'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      status: 'authenticated'
    });
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Add transfer
    fireEvent.click(screen.getByTestId('add-transfer-button'));
    
    // Check that transfer was added
    expect(setItem).toHaveBeenCalledWith('history_test@example.com', expect.any(String));
    expect(screen.getByTestId('transfer-count')).toHaveTextContent('1');
  });
  
  it('clears transfer history when authenticated', async () => {
    const { useSession } = require('next-auth/react');
    const { removeItem } = window.localStorage;
    
    // Mock authenticated session
    useSession.mockReturnValue({
      data: {
        user: {
          email: 'test@example.com'
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      status: 'authenticated'
    });
    
    render(
      <SessionProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SessionProvider>
    );
    
    // Add transfer first
    fireEvent.click(screen.getByTestId('add-transfer-button'));
    expect(screen.getByTestId('transfer-count')).toHaveTextContent('1');
    
    // Clear history
    fireEvent.click(screen.getByTestId('clear-history-button'));
    
    // Check that history was cleared
    expect(removeItem).toHaveBeenCalledWith('history_test@example.com');
    expect(screen.getByTestId('transfer-count')).toHaveTextContent('0');
  });
});