/**
 * Authentication error page
 * 
 * This page displays authentication errors and provides options to retry
 * or continue without signing in.
 */

"use client";

import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../../components/AppShell';
import { useError } from '../../../contexts/ErrorContext';

export default function AuthError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useError();
  
  // Get error from URL
  const error = searchParams.get('error');
  
  // Show toast notification for the error
  useEffect(() => {
    if (error) {
      showToast(`Authentication error: ${getErrorMessage(error)}`, 'error');
    }
  }, [error, showToast]);
  
  // Handle retry sign-in
  const handleRetry = () => {
    router.push('/auth/signin');
  };
  
  // Handle continue without signing in
  const handleContinue = () => {
    router.push('/');
  };
  
  return (
    <AppShell>
      <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {getErrorMessage(error || 'unknown')}
          </p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleRetry}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={handleContinue}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Continue without signing in
          </button>
        </div>
        
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Remember, authentication is completely optional. You can use Quick-Share P2P
            without signing in and still enjoy all core functionality.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

// Helper function to get user-friendly error messages
function getErrorMessage(error: string): string {
  switch (error) {
    case 'AccessDenied':
      return 'You denied access to your Google account. Authentication is optional for using Quick-Share P2P.';
    case 'Configuration':
      return 'There is a problem with the server configuration. Please try again later.';
    case 'Verification':
      return 'The verification link is invalid or has expired. Please try signing in again.';
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCreateAccount':
    case 'EmailCreateAccount':
    case 'Callback':
    case 'OAuthAccountNotLinked':
    case 'EmailSignin':
    case 'CredentialsSignin':
    case 'SessionRequired':
      return 'An authentication error occurred. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}