/**
 * FileUpload component - Handles file selection with drag-and-drop
 * 
 * This component provides a drag-and-drop interface for file selection,
 * with fallback to standard file input for accessibility.
 */

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  maxFileSize?: number; // Maximum file size in bytes
  accept?: string; // File types to accept
  multiple?: boolean; // Allow multiple file selection
  disabled?: boolean; // Disable the component
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  maxFileSize = 10 * 1024 * 1024 * 1024, // 10GB default
  accept = '*/*',
  multiple = false,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setError(null);
    
    // If multiple is false, only use the first file
    const file = files[0];
    
    // Validate file size
    if (file.size > maxFileSize) {
      setError(`File is too large. Maximum size is ${formatFileSize(maxFileSize)}.`);
      return;
    }
    
    onFileSelect(file);
  }, [maxFileSize, onFileSelect]);
  
  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };
  
  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    handleFileSelect(e.dataTransfer.files);
  };
  
  // Handle button click
  const handleButtonClick = () => {
    if (disabled || !fileInputRef.current) return;
    fileInputRef.current.click();
  };
  
  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          disabled 
            ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-50 cursor-not-allowed'
            : isDragging 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <Image
            src="/file.svg"
            alt="Upload file"
            width={64}
            height={64}
            className="dark:invert opacity-80"
          />
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              Drag & drop your file here
            </h3>
            <p className="text-sm opacity-70">
              or click to browse your files
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={disabled}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Select File
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleInputChange}
            accept={accept}
            multiple={multiple}
            disabled={disabled}
          />
          
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
          
          <p className="text-xs opacity-70 mt-4">
            Maximum file size: {formatFileSize(maxFileSize)}
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default FileUpload;