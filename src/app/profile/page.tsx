/**
 * Profile page component
 * 
 * This page allows authenticated users to view and update their preferences.
 * It demonstrates how authentication enhances the platform without being required.
 */

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { useError } from '../../contexts/ErrorContext';

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, user, preferences, updatePreferences, logout } = useAuth();
  const { showToast } = useError();
  
  // Form state
  const [formValues, setFormValues] = useState({
    darkMode: preferences.darkMode || false,
    notificationsEnabled: preferences.notificationsEnabled || true,
    defaultChunkSize: preferences.defaultChunkSize || 1024 * 1024, // 1MB default
  });
  
  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setFormValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updatePreferences({
        darkMode: formValues.darkMode,
        notificationsEnabled: formValues.notificationsEnabled,
        defaultChunkSize: Number(formValues.defaultChunkSize)
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      showToast('Failed to update preferences. Please try again.', 'error');
    }
  };
  
  // Redirect to sign in if not authenticated
  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4">Profile</h1>
          <p className="mb-6">You need to sign in to view and manage your profile.</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </AppShell>
    );
  }
  
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Profile & Preferences</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage your account settings and preferences
            </p>
          </div>
          
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || 'User'}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p>{user?.name || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p>{user?.email || 'Not provided'}</p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Preferences</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="darkMode" className="font-medium">Dark Mode</label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable dark mode for the application
                </p>
              </div>
              <div className="relative inline-block w-12 align-middle select-none">
                <input
                  type="checkbox"
                  name="darkMode"
                  id="darkMode"
                  checked={formValues.darkMode}
                  onChange={handleChange}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  htmlFor="darkMode"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="notificationsEnabled" className="font-medium">Notifications</label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable notifications for transfer events
                </p>
              </div>
              <div className="relative inline-block w-12 align-middle select-none">
                <input
                  type="checkbox"
                  name="notificationsEnabled"
                  id="notificationsEnabled"
                  checked={formValues.notificationsEnabled}
                  onChange={handleChange}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  htmlFor="notificationsEnabled"
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </div>
            
            <div>
              <label htmlFor="defaultChunkSize" className="font-medium">Default Chunk Size</label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Set the default chunk size for file transfers (larger chunks may be faster but less reliable on unstable connections)
              </p>
              <select
                name="defaultChunkSize"
                id="defaultChunkSize"
                value={formValues.defaultChunkSize}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value={256 * 1024}>Small (256 KB)</option>
                <option value={512 * 1024}>Medium (512 KB)</option>
                <option value={1024 * 1024}>Default (1 MB)</option>
                <option value={2 * 1024 * 1024}>Large (2 MB)</option>
                <option value={4 * 1024 * 1024}>Very Large (4 MB)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </form>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="space-y-4">
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}