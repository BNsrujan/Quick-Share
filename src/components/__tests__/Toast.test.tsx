/**
 * Tests for Toast component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast', () => {
  it('should render with success type', () => {
    const onClose = jest.fn();
    render(
      <Toast
        message="Success message"
        type="success"
        onClose={onClose}
      />
    );
    
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('opacity-100');
  });
  
  it('should render with error type', () => {
    const onClose = jest.fn();
    render(
      <Toast
        message="Error message"
        type="error"
        onClose={onClose}
      />
    );
    
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('opacity-100');
  });
  
  it('should render with warning type', () => {
    const onClose = jest.fn();
    render(
      <Toast
        message="Warning message"
        type="warning"
        onClose={onClose}
      />
    );
    
    expect(screen.getByText('Warning message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('opacity-100');
  });
  
  it('should render with info type', () => {
    const onClose = jest.fn();
    render(
      <Toast
        message="Info message"
        type="info"
        onClose={onClose}
      />
    );
    
    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('opacity-100');
  });
  
  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <Toast
        message="Test message"
        type="info"
        onClose={onClose}
      />
    );
    
    fireEvent.click(screen.getByRole('button'));
    
    // Should trigger animation first
    expect(screen.getByRole('alert')).toHaveClass('opacity-0');
    
    // onClose should be called after animation
    setTimeout(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    }, 300);
  });
  
  it('should auto-close after duration', async () => {
    jest.useFakeTimers();
    
    const onClose = jest.fn();
    render(
      <Toast
        message="Auto-close message"
        type="info"
        duration={1000}
        onClose={onClose}
      />
    );
    
    // Progress bar should start at 100%
    const progressBar = screen.getByRole('alert').querySelector('div > div:last-child > div');
    expect(progressBar).toHaveStyle('width: 100%');
    
    // Fast-forward timers
    jest.advanceTimersByTime(1000);
    
    // Should trigger animation
    expect(screen.getByRole('alert')).toHaveClass('opacity-0');
    
    // onClose should be called after animation
    jest.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledTimes(1);
    
    jest.useRealTimers();
  });
  
  it('should be accessible', () => {
    const onClose = jest.fn();
    render(
      <Toast
        message="Accessible message"
        type="info"
        onClose={onClose}
      />
    );
    
    // Should have appropriate ARIA attributes
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    
    // Close button should have accessible name
    expect(screen.getByRole('button')).toHaveAccessibleName('Close');
  });
});