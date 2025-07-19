/**
 * Home page - Main landing page for the Quick-Share P2P platform
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AppShell } from '../components';

export default function Home() {
  const router = useRouter();
  
  return (
    <AppShell>
      <div className="flex flex-col gap-[32px] items-center max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center">Quick-Share P2P</h1>
        <p className="text-xl text-center max-w-2xl">
          A browser-based, ultra-secure peer-to-peer file sharing platform that enables 
          direct encrypted file transfers without central storage.
        </p>

        <div className="flex flex-col gap-8 items-center mt-8">
          <div className="flex gap-4 items-center flex-col sm:flex-row">
            <button
              onClick={() => router.push('/send')}
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            >
              <Image
                aria-hidden
                src="/file.svg"
                alt="File icon"
                width={20}
                height={20}
                className="dark:invert"
              />
              Send Files
            </button>
            <button
              onClick={() => router.push('/receive')}
              className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto"
            >
              Receive Files
            </button>
          </div>
          
          <div className="text-center max-w-md text-sm opacity-80 mt-4">
            <p>End-to-end encrypted • No server storage • Direct P2P transfer</p>
          </div>
        </div>
        
        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12">
          <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 className="font-medium">End-to-End Encryption</h3>
            </div>
            <p className="text-sm opacity-70">
              All transfers are secured with AES-256-GCM encryption, ensuring your files remain private.
            </p>
          </div>
          
          <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
              </div>
              <h3 className="font-medium">High-Speed Transfers</h3>
            </div>
            <p className="text-sm opacity-70">
              Direct peer-to-peer connections with parallel chunking for maximum speed.
            </p>
          </div>
          
          <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 className="font-medium">No Server Storage</h3>
            </div>
            <p className="text-sm opacity-70">
              Files are transferred directly between browsers with no intermediate storage.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}