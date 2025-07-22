/**
 * ShareCode component - Displays share code and QR code
 * 
 * This component displays the generated share code for the user to share,
 * along with a QR code for easy mobile scanning.
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

interface ShareCodeProps {
  code: string;
  onCopy?: () => void;
}

export const ShareCode: React.FC<ShareCodeProps> = ({ code, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [qrCodeError, setQrCodeError] = useState(false);
  const [qrCodeLoading, setQrCodeLoading] = useState(true);
  
  // Generate QR code using client-side library
  useEffect(() => {
    if (code) {
      setQrCodeLoading(true);
      setQrCodeError(false);
      
      // Generate QR code as data URL
      QRCode.toDataURL(code, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
        .then(url => {
          console.log('Generated QR code data URL');
          setQrCodeUrl(url);
          setQrCodeLoading(false);
        })
        .catch(err => {
          console.error('Error generating QR code:', err);
          setQrCodeError(true);
          setQrCodeLoading(false);
        });
    }
  }, [code]);
  
  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      
      if (onCopy) {
        onCopy();
      }
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };
  
  // Format code for display (add spaces for readability)
  const formattedCode = code.match(/.{1,4}/g)?.join(' ') || code;
  
  return (
    <div className="flex flex-col items-center p-6 border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <h3 className="text-lg font-medium mb-4">Share this code to connect</h3>
      
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* QR Code */}
        <div className="bg-white p-3 rounded-lg shadow-sm">
          {qrCodeError ? (
            <div className="w-[150px] h-[150px] bg-gray-100 dark:bg-gray-600 rounded flex flex-col items-center justify-center text-center p-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-gray-400 mb-2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-xs text-gray-500">QR code unavailable</span>
            </div>
          ) : qrCodeUrl && !qrCodeLoading ? (
            <>
              <Image 
                src={qrCodeUrl} 
                alt="QR Code" 
                width={150} 
                height={150} 
                className="rounded"
                onError={(e) => {
                  console.error('QR Code image failed to load:', e);
                  setQrCodeError(true);
                  setQrCodeLoading(false);
                }}
                onLoad={() => {
                  console.log('QR Code image loaded successfully');
                  setQrCodeLoading(false);
                }}
              />
              {/* Fallback regular img tag in case Next.js Image has issues */}
              <noscript>
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code" 
                  width={150} 
                  height={150} 
                  className="rounded"
                />
              </noscript>
            </>
          ) : (
            <div className="w-[150px] h-[150px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex items-center justify-center">
              <span className="text-sm text-gray-500">Loading QR...</span>
            </div>
          )}
        </div>
        
        {/* Share Code */}
        <div className="flex flex-col items-center sm:items-start gap-3">
          <div 
            className="font-mono text-2xl font-bold tracking-wider bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-md"
            data-testid="share-code"
          >
            {formattedCode}
          </div>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {copied ? (
                <>
                  <path d="M20 6L9 17l-5-5" />
                </>
              ) : (
                <>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </>
              )}
            </svg>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          
          <p className="text-sm opacity-70 text-center sm:text-left mt-2">
            This code will expire once the transfer is complete
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareCode;