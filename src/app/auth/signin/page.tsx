/**
 * Sign-in page component
 * 
 * This page provides a Google sign-in option while emphasizing that
 * authentication is optional for using the platform.
 */

"use client";

import React from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AppShell } from '../../../components/AppShell';

export default function SignIn() {
  const router = useRouter();
  
  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    await signIn('google', { callbackUrl: '/' });
  };
  
  // Handle skip authentication
  const handleSkip = () => {
    router.push('/');
  };
  
  return (
    <AppShell>
      <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Sign In (Optional)</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Authentication is completely optional. You can use Quick-Share P2P without signing in.
          </p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
          
          <div className="text-center">
            <span className="text-gray-500">or</span>
          </div>
          
          <button
            onClick={handleSkip}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Continue without signing in
          </button>
        </div>
        
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>
            By signing in, you can access additional features like:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Saving your transfer history</li>
            <li>Customizing your preferences</li>
            <li>Syncing settings across devices</li>
          </ul>
          <p className="mt-4">
            Your privacy is our priority. We never store your files or encryption keys.
          </p>
        </div>
      </div>
    </AppShell>
  );
}