/**
 * TransferProgress component - Shows transfer progress with controls
 * 
 * This component displays the current transfer progress with a progress bar,
 * transfer speed, ETA, and controls for pausing, resuming, or canceling the transfer.
 */

import React from 'react';
import { TransferState, TransferStatus } from '../types/transfer';

interface TransferProgressProps {
  transfer: TransferState;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const TransferProgress: React.FC<TransferProgressProps> = ({
  transfer,
  onPause,
  onResume,
  onCancel,
}) => {
  const { status, progress, file } = transfer;
  
  // Format transfer speed
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(1)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else if (bytesPerSecond < 1024 * 1024 * 1024) {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
    }
  };
  
  // Format ETA
  const formatEta = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    } else if (seconds < 60 * 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.ceil(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / (60 * 60));
      const minutes = Math.floor((seconds % (60 * 60)) / 60);
      return `${hours}h ${minutes}m`;
    }
  };
  
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };
  
  // Get status text
  const getStatusText = (status: TransferStatus): string => {
    switch (status) {
      case 'idle':
        return 'Ready to transfer';
      case 'connecting':
        return 'Connecting...';
      case 'transferring':
        return 'Transferring';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown status';
    }
  };
  
  // Get progress percentage
  const progressPercentage = Math.min(100, Math.max(0, progress.percentage));
  
  // Determine if controls should be enabled
  const canPause = status === 'transferring';
  const canResume = status === 'paused';
  const canCancel = status !== 'completed' && status !== 'error';
  
  return (
    <div className="w-full border rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm">
      <div className="space-y-4">
        {/* File info */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium truncate" title={file.name}>
              {file.name}
            </h3>
            <p className="text-sm opacity-70">
              {formatFileSize(file.size)}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
              status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
              status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {getStatusText(status)}
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${
              status === 'completed' ? 'bg-green-500' :
              status === 'error' ? 'bg-red-500' :
              status === 'paused' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Progress details */}
        <div className="flex justify-between text-sm">
          <div>
            {status === 'transferring' && (
              <span>{formatSpeed(progress.speed)}</span>
            )}
          </div>
          <div data-testid="progress-percentage">
            {progressPercentage.toFixed(1)}%
          </div>
          <div>
            {status === 'transferring' && progress.eta > 0 && (
              <span>{formatEta(progress.eta)} remaining</span>
            )}
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex justify-end gap-3 pt-2">
          {canPause && (
            <button
              onClick={onPause}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Pause
            </button>
          )}
          
          {canResume && (
            <button
              onClick={onResume}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Resume
            </button>
          )}
          
          {canCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferProgress;