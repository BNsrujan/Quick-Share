"use client";

/**
 * Error Context - Global error handling and notification system
 * 
 * This context provides a centralized way to handle errors and display notifications
 * throughout the application with consistent styling and behavior.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ErrorType, TransferError } from '../types/transfer';
import { Toast } from '../components/Toast';

export interface ErrorContextType {
  // Error handling
  error: TransferError | null;
  setError: (error: TransferError | null) => void;
  clearError: () => void;
  
  // Toast notifications
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  
  // Recovery suggestions
  getRecoverySuggestion: (errorType: ErrorType) => string;
  
  // Retry mechanisms
  retryOperation: (operation: () => Promise<any>, maxRetries?: number) => Promise<any>;
}

// Default recovery suggestions for each error type
export const ERROR_RECOVERY_SUGGESTIONS: Record<ErrorType, string> = {
  [ErrorType.CONNECTION_FAILED]: "Check your internet connection and try again. If the problem persists, try using a different network.",
  [ErrorType.TRANSFER_INTERRUPTED]: "The transfer was interrupted. Click 'Resume' to continue from where you left off.",
  [ErrorType.ENCRYPTION_ERROR]: "There was a problem with encryption. Try refreshing the page and starting a new transfer.",
  [ErrorType.INVALID_CODE]: "The share code you entered is invalid or expired. Double-check the code and try again.",
  [ErrorType.FILE_TOO_LARGE]: "The file is too large for transfer. The maximum size is 10GB. Try compressing the file or splitting it into smaller parts.",
  [ErrorType.BROWSER_UNSUPPORTED]: "Your browser doesn't support all features needed for secure file transfers. Try using the latest version of Chrome, Firefox, Safari, or Edge.",
  [ErrorType.NETWORK_ERROR]: "A network error occurred. Check your connection and try again. If you're behind a firewall or VPN, it might be blocking the connection.",
  [ErrorType.TIMEOUT]: "The connection timed out. The other user may have left or their connection may be unstable. Try again or create a new share code."
};

// Create context with default values
const ErrorContext = createContext<ErrorContextType>({
  error: null,
  setError: () => {},
  clearError: () => {},
  showToast: () => {},
  getRecoverySuggestion: () => "",
  retryOperation: async () => {}
});

interface ErrorProviderProps {
  children: ReactNode;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [error, setErrorState] = useState<TransferError | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Set error and optionally show toast notification
  const setError = useCallback((newError: TransferError | null, showNotification = true) => {
    setErrorState(newError);
    
    if (newError && showNotification) {
      showToast(newError.message, 'error');
    }
  }, []);
  
  // Clear current error
  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);
  
  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after delay
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000); // 5 seconds
  }, []);
  
  // Get recovery suggestion for error type
  const getRecoverySuggestion = useCallback((errorType: ErrorType): string => {
    return ERROR_RECOVERY_SUGGESTIONS[errorType] || "An unexpected error occurred. Please try again.";
  }, []);
  
  // Retry operation with exponential backoff
  const retryOperation = useCallback(async (operation: () => Promise<any>, maxRetries = 3): Promise<any> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }, []);
  
  return (
    <ErrorContext.Provider
      value={{
        error,
        setError,
        clearError,
        showToast,
        getRecoverySuggestion,
        retryOperation
      }}
    >
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          />
        ))}
      </div>
    </ErrorContext.Provider>
  );
};

// Custom hook for using the error context
export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  
  return context;
};