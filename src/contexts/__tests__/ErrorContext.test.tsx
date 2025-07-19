/**
 * Tests for ErrorContext
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorProvider, useError } from '../ErrorContext';
import { ErrorType } from '../../types/transfer';
import { ExtendedErrorType, createError } from '../../types/error';

// Test component that uses the error context
const TestComponent = () => {
  const { error, setError, clearError, showToast, getRecoverySuggestion, retryOperation } = useError();
  
  const handleSetError = () => {
    setError({
      type: ErrorType.CONNECTION_FAILED,
      message: 'Test error message',
      recoverable: true
    });
  };
  
  const handleClearError = () => {
    clearError();
  };
  
  const handleShowToast = (type: 'success' | 'error' | 'info' | 'warning') => {
    showToast(`Test ${type} toast`, type);
  };
  
  const handleRetryOperation = async () => {
    let attempts = 0;
    try {
      await retryOperation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Test retry error');
        }
        return Promise.resolve('success');
      }, 3);
      showToast('Retry succeeded', 'success');
    } catch (err) {
      showToast('Retry failed', 'error');
    }
  };
  
  return (
    <div>
      <div data-testid="error-message">{error?.message || 'No error'}</div>
      <div data-testid="error-type">{error?.type || 'None'}</div>
      <div data-testid="recovery-suggestion">
        {error ? getRecoverySuggestion(error.type) : 'No suggestion'}
      </div>
      
      <button onClick={handleSetError} data-testid="set-error-btn">Set Error</button>
      <button onClick={handleClearError} data-testid="clear-error-btn">Clear Error</button>
      <button onClick={() => handleShowToast('success')} data-testid="show-success-toast-btn">Show Success Toast</button>
      <button onClick={() => handleShowToast('error')} data-testid="show-error-toast-btn">Show Error Toast</button>
      <button onClick={handleRetryOperation} data-testid="retry-operation-btn">Retry Operation</button>
    </div>
  );
};

describe('ErrorContext', () => {
  it('should provide error context to components', () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    expect(screen.getByTestId('error-message')).toHaveTextContent('No error');
    expect(screen.getByTestId('error-type')).toHaveTextContent('None');
  });
  
  it('should set and clear errors', () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    // Set error
    fireEvent.click(screen.getByTestId('set-error-btn'));
    expect(screen.getByTestId('error-message')).toHaveTextContent('Test error message');
    expect(screen.getByTestId('error-type')).toHaveTextContent(ErrorType.CONNECTION_FAILED);
    
    // Clear error
    fireEvent.click(screen.getByTestId('clear-error-btn'));
    expect(screen.getByTestId('error-message')).toHaveTextContent('No error');
    expect(screen.getByTestId('error-type')).toHaveTextContent('None');
  });
  
  it('should show toast notifications', async () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    // Show success toast
    fireEvent.click(screen.getByTestId('show-success-toast-btn'));
    expect(screen.getByText('Test success toast')).toBeInTheDocument();
    
    // Toast should disappear after timeout
    await waitFor(() => {
      expect(screen.queryByText('Test success toast')).not.toBeInTheDocument();
    }, { timeout: 6000 });
  });
  
  it('should provide recovery suggestions for errors', () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    // Set error
    fireEvent.click(screen.getByTestId('set-error-btn'));
    
    // Should show recovery suggestion
    expect(screen.getByTestId('recovery-suggestion')).not.toHaveTextContent('No suggestion');
    expect(screen.getByTestId('recovery-suggestion')).toHaveTextContent(/Check your/);
  });
  
  it('should retry operations with exponential backoff', async () => {
    jest.useFakeTimers();
    
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    // Start retry operation
    fireEvent.click(screen.getByTestId('retry-operation-btn'));
    
    // Fast-forward timers
    jest.advanceTimersByTime(3000);
    
    // Should show success toast after retry
    await waitFor(() => {
      expect(screen.getByText('Retry succeeded')).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });
  
  it('should handle extended error types', () => {
    const TestExtendedError = () => {
      const { setError, error, getRecoverySuggestion } = useError();
      
      const handleSetExtendedError = () => {
        setError(createError(ExtendedErrorType.ICE_CONNECTION_FAILED));
      };
      
      return (
        <div>
          <button onClick={handleSetExtendedError} data-testid="set-extended-error-btn">Set Extended Error</button>
          <div data-testid="extended-error-message">{error?.message || 'No error'}</div>
          <div data-testid="extended-error-type">{error?.type || 'None'}</div>
          <div data-testid="extended-recovery-suggestion">
            {error?.details?.recovery || 'No suggestion'}
          </div>
        </div>
      );
    };
    
    render(
      <ErrorProvider>
        <TestExtendedError />
      </ErrorProvider>
    );
    
    // Set extended error
    fireEvent.click(screen.getByTestId('set-extended-error-btn'));
    
    // Should show extended error details
    expect(screen.getByTestId('extended-error-message')).toHaveTextContent('Failed to establish');
    expect(screen.getByTestId('extended-error-type')).toHaveTextContent(ErrorType.CONNECTION_FAILED);
    expect(screen.getByTestId('extended-recovery-suggestion')).toHaveTextContent(/Try again with a new share code/);
  });
});