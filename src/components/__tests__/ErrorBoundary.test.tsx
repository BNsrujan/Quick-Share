/**
 * Tests for ErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws an error
const ErrorThrowingComponent = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error for expected errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
  
  it('should render fallback UI when an error occurs', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
  
  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });
  
  it('should render function fallback with error and reset function', () => {
    render(
      <ErrorBoundary
        fallback={(error, resetError) => (
          <div>
            <div>Custom error: {error.message}</div>
            <button onClick={resetError}>Reset</button>
          </div>
        )}
      >
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });
  
  it('should reset error state when reset button is clicked', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      return (
        <ErrorBoundary>
          {shouldThrow ? (
            <ErrorThrowingComponent />
          ) : (
            <div>Error resolved</div>
          )}
          <button onClick={() => setShouldThrow(false)}>Fix error</button>
        </ErrorBoundary>
      );
    };
    
    render(<TestComponent />);
    
    // Error is shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Click try again button
    fireEvent.click(screen.getByText('Try Again'));
    
    // Error is still shown because the component still throws
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Fix the error
    fireEvent.click(screen.getByText('Fix error'));
    
    // Error should be resolved
    expect(screen.getByText('Error resolved')).toBeInTheDocument();
  });
  
  it('should call onError when an error occurs', () => {
    const onError = jest.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Test error');
    expect(onError.mock.calls[0][1]).toBeDefined(); // ErrorInfo
  });
});