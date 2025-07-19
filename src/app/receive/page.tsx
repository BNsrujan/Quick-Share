/**
 * Receive page - For receiving files from other users
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppShell, CodeInput, TransferProgress } from '../../components';
import { useP2PTransfer } from '../../hooks';
import { useError } from '../../contexts/ErrorContext';

export default function ReceivePage() {
  const [activeStep, setActiveStep] = useState<'input' | 'transfer' | 'complete'>('input');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [receivedFile, setReceivedFile] = useState<{ name: string; size: number; type: string; url: string } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { state, actions, isSupported } = useP2PTransfer();
  const { showToast } = useError();
  const fileNameRef = useRef<string>('received-file');

  // Ensure we're on the client side to prevent hydration errors
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle code submission
  const handleCodeSubmit = async (code: string) => {
    if (!isClient || !isSupported) {
      showToast('Your browser does not support P2P file sharing. Please use a modern browser.', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Join room with the provided code
      await actions.joinRoom(code);
      
      // Show success toast
      showToast('Connected successfully! Waiting for file transfer to start.', 'success');
      
      // Move to transfer step
      setActiveStep('transfer');
    } catch (err: any) {
      console.error('Failed to join room:', err);
      
      // Set local error for the input component
      setError(err.message || 'Failed to connect. Please check the code and try again.');
      
      // Show toast with error
      showToast('Connection failed. Please check the code and try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle file received
  const handleFileReceived = (blob: Blob, fileName: string = 'received-file') => {
    const url = URL.createObjectURL(blob);
    fileNameRef.current = fileName;
    
    setReceivedFile({
      name: fileName,
      size: blob.size,
      type: blob.type || 'application/octet-stream',
      url
    });
    
    setActiveStep('complete');
  };
  
  // Handle transfer completion
  useEffect(() => {
    if (state.status === 'completed' && state.progress) {
      showToast('File received successfully!', 'success');
      
      // Create a file name based on the transfer metadata if available
      const fileName = fileNameRef.current || 'received-file';
      
      // Trigger file download
      if (state.receivedBlob) {
        handleFileReceived(state.receivedBlob, fileName);
      }
    } else if (state.status === 'error' && state.error) {
      showToast(`Transfer failed: ${state.error.message}`, 'error');
    }
  }, [state.status, state.error, state.receivedBlob, showToast]);

  // Render content based on current step
  const renderContent = () => {
    switch (activeStep) {
      case 'input':
        return (
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Receive a File</h1>
            <p className="text-center mb-8 opacity-70">
              Enter the share code provided by the sender
            </p>
            {isClient && !isSupported && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                Your browser does not support P2P file sharing. Please use a modern browser.
              </div>
            )}
            <CodeInput
              onSubmit={handleCodeSubmit}
              codeLength={8}
              loading={isLoading}
              error={error}
              disabled={isClient && !isSupported}
            />
          </div>
        );
      
      case 'transfer':
        return (
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Receiving File</h1>
            
            {state.progress ? (
              <div className="space-y-4">
                <TransferProgress
                  transfer={{
                    status: state.status,
                    progress: state.progress,
                    file: {
                      name: 'Incoming File',
                      size: state.progress.totalBytes,
                      type: 'application/octet-stream'
                    },
                    error: state.error
                  }}
                  onPause={actions.pauseTransfer}
                  onResume={actions.resumeTransfer}
                  onCancel={() => {
                    actions.cancelTransfer();
                    setActiveStep('input');
                  }}
                />
              </div>
            ) : (
              <div className="text-center p-8 border rounded-lg">
                <div className="mb-4">
                  <p className="mb-2">
                    {state.status === 'connected' ? 'Connected! Waiting for sender to start transfer...' : 
                     state.status === 'connecting' ? 'Connecting...' : 
                     'Preparing to receive file...'}
                  </p>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                </div>
                <button
                  onClick={() => {
                    actions.disconnect();
                    setActiveStep('input');
                  }}
                  className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
        
      case 'complete':
        return (
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">File Received Successfully!</h1>
            
            {receivedFile && (
              <div className="p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex items-center justify-center mb-6">
                  <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                    <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-medium mb-2">File Received</h3>
                  <p className="opacity-70">{receivedFile.name}</p>
                  <p className="text-sm opacity-50 mt-1">
                    {formatBytes(receivedFile.size)} • {receivedFile.type}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href={receivedFile.url}
                    download={receivedFile.name}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-center"
                  >
                    Download File
                  </a>
                  
                  <button
                    onClick={() => {
                      // Clean up the URL object
                      if (receivedFile.url) {
                        URL.revokeObjectURL(receivedFile.url);
                      }
                      
                      // Reset state
                      setReceivedFile(null);
                      actions.disconnect();
                      setActiveStep('input');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Receive Another File
                  </button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <AppShell>
      {renderContent()}
    </AppShell>
  );
}