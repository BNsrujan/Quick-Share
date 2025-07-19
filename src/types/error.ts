/**
 * Error types and handling utilities
 * 
 * This module defines the error types and utilities for error handling
 * throughout the application.
 */

import { ErrorType, TransferError } from './transfer';

/**
 * Extended error types for more specific error handling
 */
export enum ExtendedErrorType {
  // Connection errors
  SIGNALING_SERVER_UNREACHABLE = 'signaling_server_unreachable',
  ICE_CONNECTION_FAILED = 'ice_connection_failed',
  STUN_SERVER_UNREACHABLE = 'stun_server_unreachable',
  PEER_DISCONNECTED = 'peer_disconnected',
  
  // Encryption errors
  KEY_DERIVATION_FAILED = 'key_derivation_failed',
  ENCRYPTION_FAILED = 'encryption_failed',
  DECRYPTION_FAILED = 'decryption_failed',
  INTEGRITY_CHECK_FAILED = 'integrity_check_failed',
  
  // File errors
  FILE_READ_ERROR = 'file_read_error',
  FILE_WRITE_ERROR = 'file_write_error',
  UNSUPPORTED_FILE_TYPE = 'unsupported_file_type',
  
  // Browser support errors
  WEBRTC_NOT_SUPPORTED = 'webrtc_not_supported',
  CRYPTO_API_NOT_SUPPORTED = 'crypto_api_not_supported',
  STORAGE_NOT_SUPPORTED = 'storage_not_supported',
  
  // User errors
  INVALID_INPUT = 'invalid_input',
  PERMISSION_DENIED = 'permission_denied',
  
  // System errors
  OUT_OF_MEMORY = 'out_of_memory',
  QUOTA_EXCEEDED = 'quota_exceeded',
  INTERNAL_ERROR = 'internal_error'
}

/**
 * Maps extended error types to base error types
 */
export const ERROR_TYPE_MAPPING: Record<ExtendedErrorType, ErrorType> = {
  // Connection errors
  [ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE]: ErrorType.CONNECTION_FAILED,
  [ExtendedErrorType.ICE_CONNECTION_FAILED]: ErrorType.CONNECTION_FAILED,
  [ExtendedErrorType.STUN_SERVER_UNREACHABLE]: ErrorType.CONNECTION_FAILED,
  [ExtendedErrorType.PEER_DISCONNECTED]: ErrorType.TRANSFER_INTERRUPTED,
  
  // Encryption errors
  [ExtendedErrorType.KEY_DERIVATION_FAILED]: ErrorType.ENCRYPTION_ERROR,
  [ExtendedErrorType.ENCRYPTION_FAILED]: ErrorType.ENCRYPTION_ERROR,
  [ExtendedErrorType.DECRYPTION_FAILED]: ErrorType.ENCRYPTION_ERROR,
  [ExtendedErrorType.INTEGRITY_CHECK_FAILED]: ErrorType.ENCRYPTION_ERROR,
  
  // File errors
  [ExtendedErrorType.FILE_READ_ERROR]: ErrorType.TRANSFER_INTERRUPTED,
  [ExtendedErrorType.FILE_WRITE_ERROR]: ErrorType.TRANSFER_INTERRUPTED,
  [ExtendedErrorType.UNSUPPORTED_FILE_TYPE]: ErrorType.FILE_TOO_LARGE,
  
  // Browser support errors
  [ExtendedErrorType.WEBRTC_NOT_SUPPORTED]: ErrorType.BROWSER_UNSUPPORTED,
  [ExtendedErrorType.CRYPTO_API_NOT_SUPPORTED]: ErrorType.BROWSER_UNSUPPORTED,
  [ExtendedErrorType.STORAGE_NOT_SUPPORTED]: ErrorType.BROWSER_UNSUPPORTED,
  
  // User errors
  [ExtendedErrorType.INVALID_INPUT]: ErrorType.INVALID_CODE,
  [ExtendedErrorType.PERMISSION_DENIED]: ErrorType.NETWORK_ERROR,
  
  // System errors
  [ExtendedErrorType.OUT_OF_MEMORY]: ErrorType.TRANSFER_INTERRUPTED,
  [ExtendedErrorType.QUOTA_EXCEEDED]: ErrorType.FILE_TOO_LARGE,
  [ExtendedErrorType.INTERNAL_ERROR]: ErrorType.NETWORK_ERROR
};

/**
 * User-friendly error messages for extended error types
 */
export const EXTENDED_ERROR_MESSAGES: Record<ExtendedErrorType, string> = {
  // Connection errors
  [ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE]: "Unable to reach the signaling server. Please check your internet connection.",
  [ExtendedErrorType.ICE_CONNECTION_FAILED]: "Failed to establish a direct connection with the other peer.",
  [ExtendedErrorType.STUN_SERVER_UNREACHABLE]: "Unable to determine your network address. Your firewall may be blocking the connection.",
  [ExtendedErrorType.PEER_DISCONNECTED]: "The other user has disconnected.",
  
  // Encryption errors
  [ExtendedErrorType.KEY_DERIVATION_FAILED]: "Failed to generate encryption keys. Please try again with a new share code.",
  [ExtendedErrorType.ENCRYPTION_FAILED]: "Failed to encrypt the file. This may be due to an unsupported file format.",
  [ExtendedErrorType.DECRYPTION_FAILED]: "Failed to decrypt the file. The share code may be incorrect.",
  [ExtendedErrorType.INTEGRITY_CHECK_FAILED]: "File integrity check failed. The file may be corrupted.",
  
  // File errors
  [ExtendedErrorType.FILE_READ_ERROR]: "Failed to read the file. The file may be corrupted or inaccessible.",
  [ExtendedErrorType.FILE_WRITE_ERROR]: "Failed to save the file. You may not have enough disk space.",
  [ExtendedErrorType.UNSUPPORTED_FILE_TYPE]: "This file type is not supported for transfer.",
  
  // Browser support errors
  [ExtendedErrorType.WEBRTC_NOT_SUPPORTED]: "Your browser doesn't support WebRTC, which is required for peer-to-peer transfers.",
  [ExtendedErrorType.CRYPTO_API_NOT_SUPPORTED]: "Your browser doesn't support the Web Crypto API, which is required for secure transfers.",
  [ExtendedErrorType.STORAGE_NOT_SUPPORTED]: "Your browser doesn't support the storage features required for pause/resume functionality.",
  
  // User errors
  [ExtendedErrorType.INVALID_INPUT]: "The share code you entered is invalid or has expired.",
  [ExtendedErrorType.PERMISSION_DENIED]: "Permission denied. You may need to allow access to certain browser features.",
  
  // System errors
  [ExtendedErrorType.OUT_OF_MEMORY]: "Out of memory. The file may be too large for your device.",
  [ExtendedErrorType.QUOTA_EXCEEDED]: "Storage quota exceeded. You may not have enough space to store this file.",
  [ExtendedErrorType.INTERNAL_ERROR]: "An internal error occurred. Please try again."
};

/**
 * Recovery suggestions for extended error types
 */
export const EXTENDED_ERROR_RECOVERY: Record<ExtendedErrorType, string> = {
  // Connection errors
  [ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE]: "Check your internet connection and try again. If the problem persists, the server may be down.",
  [ExtendedErrorType.ICE_CONNECTION_FAILED]: "Try again with a new share code. If the problem persists, both users may need to use a different network.",
  [ExtendedErrorType.STUN_SERVER_UNREACHABLE]: "Check if your firewall or VPN is blocking WebRTC connections. Try using a different network.",
  [ExtendedErrorType.PEER_DISCONNECTED]: "Ask the other user to reconnect. If the transfer was in progress, you can try to resume it.",
  
  // Encryption errors
  [ExtendedErrorType.KEY_DERIVATION_FAILED]: "Try again with a new share code. If the problem persists, try using a different browser.",
  [ExtendedErrorType.ENCRYPTION_FAILED]: "Try again with a smaller file or a different file format.",
  [ExtendedErrorType.DECRYPTION_FAILED]: "Verify that you're using the correct share code. If the problem persists, the sender may need to create a new share.",
  [ExtendedErrorType.INTEGRITY_CHECK_FAILED]: "Ask the sender to share the file again. The file may have been corrupted during transfer.",
  
  // File errors
  [ExtendedErrorType.FILE_READ_ERROR]: "Try selecting the file again. If the problem persists, the file may be corrupted.",
  [ExtendedErrorType.FILE_WRITE_ERROR]: "Check if you have enough disk space. Try saving the file to a different location.",
  [ExtendedErrorType.UNSUPPORTED_FILE_TYPE]: "Try compressing the file into a ZIP archive before sharing.",
  
  // Browser support errors
  [ExtendedErrorType.WEBRTC_NOT_SUPPORTED]: "Please use a modern browser like Chrome, Firefox, Safari, or Edge.",
  [ExtendedErrorType.CRYPTO_API_NOT_SUPPORTED]: "Please use a modern browser like Chrome, Firefox, Safari, or Edge.",
  [ExtendedErrorType.STORAGE_NOT_SUPPORTED]: "Please use a modern browser like Chrome, Firefox, Safari, or Edge. Pause/resume functionality may not be available.",
  
  // User errors
  [ExtendedErrorType.INVALID_INPUT]: "Double-check the share code and try again. Share codes are case-sensitive and expire after use.",
  [ExtendedErrorType.PERMISSION_DENIED]: "Check your browser permissions and allow access to required features.",
  
  // System errors
  [ExtendedErrorType.OUT_OF_MEMORY]: "Try closing other applications or browser tabs to free up memory. For large files, try splitting them into smaller parts.",
  [ExtendedErrorType.QUOTA_EXCEEDED]: "Free up space on your device or try using a device with more storage.",
  [ExtendedErrorType.INTERNAL_ERROR]: "Refresh the page and try again. If the problem persists, try using a different browser."
};

/**
 * Create a transfer error from an extended error type
 * 
 * @param type Extended error type
 * @param details Optional additional details
 * @returns Transfer error object
 */
export function createError(type: ExtendedErrorType, details?: any): TransferError {
  const baseType = ERROR_TYPE_MAPPING[type];
  const message = EXTENDED_ERROR_MESSAGES[type];
  
  // Determine if the error is recoverable
  const recoverable = [
    ExtendedErrorType.PEER_DISCONNECTED,
    ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE,
    ExtendedErrorType.ICE_CONNECTION_FAILED,
    ExtendedErrorType.FILE_READ_ERROR,
    ExtendedErrorType.FILE_WRITE_ERROR
  ].includes(type);
  
  return {
    type: baseType,
    message,
    recoverable,
    details: {
      extendedType: type,
      recovery: EXTENDED_ERROR_RECOVERY[type],
      ...details
    }
  };
}

/**
 * Get a recovery suggestion for an error
 * 
 * @param error Transfer error or extended error type
 * @returns Recovery suggestion
 */
export function getRecoverySuggestion(error: TransferError | ExtendedErrorType): string {
  if (typeof error === 'string') {
    return EXTENDED_ERROR_RECOVERY[error];
  }
  
  if (error.details?.extendedType) {
    return EXTENDED_ERROR_RECOVERY[error.details.extendedType];
  }
  
  // Fallback to base error type suggestions
  switch (error.type) {
    case ErrorType.CONNECTION_FAILED:
      return "Check your internet connection and try again. If the problem persists, try using a different network.";
    case ErrorType.TRANSFER_INTERRUPTED:
      return "The transfer was interrupted. Click 'Resume' to continue from where you left off.";
    case ErrorType.ENCRYPTION_ERROR:
      return "There was a problem with encryption. Try refreshing the page and starting a new transfer.";
    case ErrorType.INVALID_CODE:
      return "The share code you entered is invalid or expired. Double-check the code and try again.";
    case ErrorType.FILE_TOO_LARGE:
      return "The file is too large for transfer. Try compressing the file or splitting it into smaller parts.";
    case ErrorType.BROWSER_UNSUPPORTED:
      return "Your browser doesn't support all features needed for secure file transfers. Try using the latest version of Chrome, Firefox, Safari, or Edge.";
    case ErrorType.NETWORK_ERROR:
      return "A network error occurred. Check your connection and try again. If you're behind a firewall or VPN, it might be blocking the connection.";
    case ErrorType.TIMEOUT:
      return "The connection timed out. The other user may have left or their connection may be unstable. Try again or create a new share code.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

/**
 * Check if an error is retryable
 * 
 * @param error Transfer error or extended error type
 * @returns True if the error is retryable, false otherwise
 */
export function isRetryableError(error: TransferError | ExtendedErrorType): boolean {
  if (typeof error === 'string') {
    return [
      ExtendedErrorType.SIGNALING_SERVER_UNREACHABLE,
      ExtendedErrorType.ICE_CONNECTION_FAILED,
      ExtendedErrorType.STUN_SERVER_UNREACHABLE,
      ExtendedErrorType.PEER_DISCONNECTED,
      ExtendedErrorType.FILE_READ_ERROR,
      ExtendedErrorType.FILE_WRITE_ERROR
    ].includes(error);
  }
  
  return error.recoverable;
}

/**
 * Get a suggested retry delay for an error
 * 
 * @param error Transfer error or extended error type
 * @param attempt Current retry attempt (0-based)
 * @returns Suggested delay in milliseconds before retrying
 */
export function getRetryDelay(error: TransferError | ExtendedErrorType, attempt: number): number {
  // Exponential backoff with jitter
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  
  const exponentialDelay = Math.min(
    maxDelay,
    baseDelay * Math.pow(2, attempt)
  );
  
  // Add jitter (±20%)
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
  
  return Math.floor(exponentialDelay + jitter);
}