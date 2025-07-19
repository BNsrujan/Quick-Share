/**
 * Send page - For sending files to other users
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AppShell, FileUpload, ShareCode, TransferProgress } from '../../components';
import { useP2PTransfer } from '../../hooks';
import { useError } from '../../contexts/ErrorContext';

export default function SendPage() {
  const [activeStep, setActiveStep] = useState<'select' | 'share' | 'transfer'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { state, actions, isSupported } = useP2PTransfer();
  const { showToast } = useError();

  // Ensure we're on the client side to prevent hydration errors
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle file selection
  const handleFileSelect = async (file: File) => {
    if (!isClient || !isSupported) {
      showToast('Your browser does not support P2P file sharing. Please use a modern browser.', 'error');
      return;
    }

    try {
      setSelectedFile(file);
      
      // Create room and get share code
      const shareCode = await actions.createRoom(file);
      
      // Move to share step
      setActiveStep('share');
      
      showToast('Room created successfully! Share the code with the recipient.', 'success');
    } catch (error) {
      console.error('Failed to create room:', error);
      showToast('Failed to create room. Please try again.', 'error');
    }
  };
  
  // Handle transfer start
  const handleTransferStart = async () => {
    try {
      setActiveStep('transfer');
      await actions.startTransfer();
    } catch (error) {
      console.error('Failed to start transfer:', error);
      showToast('Failed to start transfer. Please try again.', 'error');
    }
  };

  // Handle transfer completion
  useEffect(() => {
    if (state.status === 'completed') {
      showToast('File sent successfully!', 'success');
    } else if (state.status === 'error' && state.error) {
      showToast(`Transfer failed: ${state.error.message}`, 'error');
    }
  }, [state.status, state.error, showToast]);
  
  // Render content based on current step
  const renderContent = () => {
    switch (activeStep) {
      case 'select':
        return (
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Send a File</h1>
            <p className="text-center mb-8 opacity-70">
              Select a file to share securely with end-to-end encryption
            </p>
            {isClient && !isSupported && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                Your browser does not support P2P file sharing. Please use a modern browser.
              </div>
            )}
            <FileUpload onFileSelect={handleFileSelect} disabled={isClient && !isSupported} />
          </div>
        );
      
      case 'share':
        return (
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">Share Your Code</h1>
            <p className="text-center mb-8 opacity-70">
              Share this code with the recipient to establish a secure connection
            </p>
            {state.shareCode && <ShareCode code={state.shareCode} />}
            
            <div className="mt-8 text-center">
              <div className="mb-4">
                <p className="text-sm opacity-70">
                  Status: {state.status === 'connected' ? 'Waiting for recipient...' : 'Connecting...'}
                </p>
              </div>
              <button
                onClick={handleTransferStart}
                disabled={state.status !== 'connected'}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {state.status === 'connected' ? 'Start Transfer' : 'Waiting...'}
              </button>
            </div>
          </div>
        );
      
      case 'transfer':
        return (
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-center">
              {state.status === 'completed' ? 'File Sent Successfully!' : 'Transferring File'}
            </h1>
            
            {state.progress && selectedFile ? (
              <div className="space-y-4">
                {state.status === 'completed' ? (
                  <div className="p-6 border rounded-lg text-center bg-green-50 dark:bg-green-900/20">
                    <div className="mb-4">
                      <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <h3 className="text-xl font-medium mb-2">File Sent Successfully</h3>
                    <p className="opacity-70 mb-4">{selectedFile.name} has been transferred securely</p>
                    <button
                      onClick={() => {
                        actions.disconnect();
                        setActiveStep('select');
                        setSelectedFile(null);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Send Another File
                    </button>
                  </div>
                ) : (
                  <TransferProgress
                    transfer={{
                      status: state.status,
                      progress: state.progress,
                      file: {
                        name: selectedFile.name,
                        size: selectedFile.size,
                        type: selectedFile.type
                      },
                      error: state.error
                    }}
                    onPause={actions.pauseTransfer}
                    onResume={actions.resumeTransfer}
                    onCancel={() => {
                      actions.cancelTransfer();
                      setActiveStep('select');
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="text-center p-8 border rounded-lg">
                <p>Preparing transfer...</p>
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };
  
  return (
    <AppShell>
      {renderContent()}
    </AppShell>
  );
}