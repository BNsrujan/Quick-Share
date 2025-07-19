/**
 * CodeInput component - For entering share codes
 * 
 * This component provides an interface for users to enter a share code
 * to join a file transfer session.
 */

import React, { useState, useRef, useEffect } from 'react';

interface CodeInputProps {
  onSubmit: (code: string) => void;
  codeLength?: number;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export const CodeInput: React.FC<CodeInputProps> = ({
  onSubmit,
  codeLength = 12,
  loading = false,
  error = null,
  disabled = false,
}) => {
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove spaces and non-alphanumeric characters
    const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Limit to codeLength characters
    const trimmedValue = sanitizedValue.slice(0, codeLength);
    
    setCode(trimmedValue);
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length === codeLength && !loading) {
      onSubmit(code);
    }
  };
  
  // Format code for display (add spaces for readability)
  const formattedCode = code.match(/.{1,4}/g)?.join(' ') || code;
  
  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="share-code" className="block text-sm font-medium">
            Enter Share Code
          </label>
          
          <div
            className={`relative border rounded-md transition-colors ${
              focused ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300 dark:border-gray-700'
            } ${error ? 'border-red-500 dark:border-red-500' : ''}`}
          >
            <input
              ref={inputRef}
              id="share-code"
              type="text"
              value={formattedCode}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="XXXX XXXX XXXX"
              className="w-full px-4 py-3 bg-transparent font-mono text-lg tracking-wider text-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || disabled}
              aria-invalid={!!error}
              aria-describedby={error ? "code-error" : undefined}
              data-testid="code-input"
            />
          </div>
          
          {error && (
            <p id="code-error" className="text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={code.length !== codeLength || loading || disabled}
          className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
            code.length === codeLength && !loading && !disabled
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connecting...
            </span>
          ) : (
            'Connect'
          )}
        </button>
      </form>
      
      <p className="text-sm opacity-70 text-center mt-4">
        Ask the sender for their share code
      </p>
    </div>
  );
};

export default CodeInput;