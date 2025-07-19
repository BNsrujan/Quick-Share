/**
 * AppShell component - Main application container with routing
 * 
 * This component serves as the main shell for the application, handling
 * routing between different modes (home, send, receive) and providing
 * a consistent layout across the application.
 */

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { checkBrowserSupport, getBrowserSupportMessage, getBrowserInfo } from '../utils/browser-support';
import { useError } from '../contexts/ErrorContext';
import { useAuth } from '../contexts/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useError();
  const { isAuthenticated, user, login, logout } = useAuth();
  const [browserSupport, setBrowserSupport] = useState<ReturnType<typeof checkBrowserSupport> | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Determine active route for navigation highlighting
  const isHome = pathname === '/';
  const isSend = pathname === '/send';
  const isReceive = pathname === '/receive';

  // Check browser support on mount
  useEffect(() => {
    const support = checkBrowserSupport();
    setBrowserSupport(support);
    
    // Show warning for partial support or unsupported browsers
    if (!support.fullSupport) {
      const message = getBrowserSupportMessage();
      showToast(
        support.partialSupport 
          ? `${message.message} ${message.recommended}` 
          : `${message.message} ${message.recommended}`,
        support.partialSupport ? 'warning' : 'error'
      );
    }
  }, [showToast]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setUserMenuOpen(false);
    };
    
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <div className="font-sans min-h-screen flex flex-col">
      {/* Browser support warning */}
      {browserSupport && !browserSupport.fullSupport && !browserSupport.partialSupport && (
        <div className="bg-red-500 text-white p-4 text-center" role="alert">
          <p className="font-medium">
            Your browser doesn't support essential features needed for secure file transfers.
          </p>
          <p className="text-sm mt-1">
            Please use the latest version of Chrome, Firefox, Safari, or Edge.
          </p>
        </div>
      )}
      
      {/* Header */}
      <header className="p-4 sm:p-6 flex justify-between items-center border-b border-black/[.08] dark:border-white/[.08]">
        <Link href="/" className="flex items-center gap-2">
          <Image 
            src="/globe.svg" 
            alt="Quick-Share Logo" 
            width={28} 
            height={28}
            className="dark:invert" 
          />
          <span className="font-bold text-lg">Quick-Share P2P</span>
        </Link>
        
        <nav className="hidden sm:flex gap-4 items-center">
          <Link 
            href="/" 
            className={`px-3 py-2 rounded-md transition-colors ${isHome ? 'bg-black/[.05] dark:bg-white/[.1]' : 'hover:bg-black/[.03] dark:hover:bg-white/[.05]'}`}
          >
            Home
          </Link>
          <Link 
            href="/send" 
            className={`px-3 py-2 rounded-md transition-colors ${isSend ? 'bg-black/[.05] dark:bg-white/[.1]' : 'hover:bg-black/[.03] dark:hover:bg-white/[.05]'}`}
          >
            Send
          </Link>
          <Link 
            href="/receive" 
            className={`px-3 py-2 rounded-md transition-colors ${isReceive ? 'bg-black/[.05] dark:bg-white/[.1]' : 'hover:bg-black/[.03] dark:hover:bg-white/[.05]'}`}
          >
            Receive
          </Link>
          
          {/* Authentication UI */}
          {isAuthenticated ? (
            <div className="relative ml-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-black/[.05] dark:hover:bg-white/[.1] transition-colors"
                aria-label="User menu"
              >
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/[.05] dark:ring-white/[.1] z-10">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Profile & Preferences
                    </Link>
                    <Link
                      href="/history"
                      className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Transfer History
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-black/[.05] dark:hover:bg-white/[.05]"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={login}
              className="ml-4 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          )}
        </nav>
        
        <div className="sm:hidden">
          <MobileMenu isAuthenticated={isAuthenticated} user={user} login={login} logout={logout} />
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="p-4 sm:p-6 text-center text-sm opacity-70 border-t border-black/[.08] dark:border-white/[.08]">
        <p>Quick-Share P2P • Secure • Fast • Private</p>
      </footer>
    </div>
  );
};

// Mobile menu component for responsive design
interface MobileMenuProps {
  isAuthenticated: boolean;
  user: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
  } | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isAuthenticated, user, login, logout }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-md hover:bg-black/[.05] dark:hover:bg-white/[.1] transition-colors"
        aria-label="Menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="20" y1="12" y2="12"></line>
          <line x1="4" x2="20" y1="6" y2="6"></line>
          <line x1="4" x2="20" y1="18" y2="18"></line>
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/[.05] dark:ring-white/[.1] z-10">
          {/* Navigation links */}
          <div className="py-1 border-b border-gray-200 dark:border-gray-700" role="menu" aria-orientation="vertical">
            <Link 
              href="/" 
              className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]" 
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/send" 
              className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]" 
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              Send
            </Link>
            <Link 
              href="/receive" 
              className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]" 
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              Receive
            </Link>
          </div>
          
          {/* Authentication section */}
          {isAuthenticated ? (
            <div>
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <p className="font-medium">{user?.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]"
                  onClick={() => setIsOpen(false)}
                >
                  Profile & Preferences
                </Link>
                <Link
                  href="/history"
                  className="block px-4 py-2 text-sm hover:bg-black/[.05] dark:hover:bg-white/[.05]"
                  onClick={() => setIsOpen(false)}
                >
                  Transfer History
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-black/[.05] dark:hover:bg-white/[.05]"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2 px-4">
              <button
                onClick={() => {
                  login();
                  setIsOpen(false);
                }}
                className="w-full py-2 px-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppShell;