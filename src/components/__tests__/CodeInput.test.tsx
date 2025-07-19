/**
 * Tests for CodeInput component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeInput } from '../CodeInput';

describe('CodeInput Component', () => {
  const mockOnSubmit = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the code input field', () => {
    render(<CodeInput onSubmit={mockOnSubmit} />);
    
    expect(screen.getByLabelText('Enter Share Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('XXXX XXXX XXXX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByText('Ask the sender for their share code')).toBeInTheDocument();
  });
  
  it('formats the input with spaces for readability', () => {
    render(<CodeInput onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText('Enter Share Code');
    
    // Type a code without spaces
    fireEvent.change(input, { target: { value: 'ABCD1234EFGH' } });
    
    // Check that the input displays the formatted code with spaces
    expect(input).toHaveValue('ABCD 1234 EFGH');
  });
  
  it('sanitizes input to only allow alphanumeric characters', () => {
    render(<CodeInput onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText('Enter Share Code');
    
    // Type a code with special characters and spaces
    fireEvent.change(input, { target: { value: 'AB-C D!1@2#3$4' } });
    
    // Check that the input only contains alphanumeric characters
    expect(input).toHaveValue('ABCD 1234');
  });
  
  it('limits input to the specified code length', () => {
    render(<CodeInput onSubmit={mockOnSubmit} codeLength={8} />);
    
    const input = screen.getByLabelText('Enter Share Code');
    
    // Type a code longer than the limit
    fireEvent.change(input, { target: { value: 'ABCDEFGHIJKLMNOP' } });
    
    // Check that the input is truncated to the specified length
    expect(input).toHaveValue('ABCD EFGH');
  });
  
  it('disables the submit button when code is incomplete', () => {
    render(<CodeInput onSubmit={mockOnSubmit} codeLength={12} />);
    
    const input = screen.getByLabelText('Enter Share Code');
    const submitButton = screen.getByRole('button', { name: 'Connect' });
    
    // Type a partial code
    fireEvent.change(input, { target: { value: 'ABCD1234' } });
    
    // Check that the submit button is disabled
    expect(submitButton).toBeDisabled();
  });
  
  it('enables the submit button when code is complete', () => {
    render(<CodeInput onSubmit={mockOnSubmit} codeLength={12} />);
    
    const input = screen.getByLabelText('Enter Share Code');
    const submitButton = screen.getByRole('button', { name: 'Connect' });
    
    // Type a complete code
    fireEvent.change(input, { target: { value: 'ABCD1234EFGH' } });
    
    // Check that the submit button is enabled
    expect(submitButton).not.toBeDisabled();
  });
  
  it('calls onSubmit with the sanitized code when form is submitted', () => {
    render(<CodeInput onSubmit={mockOnSubmit} codeLength={12} />);
    
    const input = screen.getByLabelText('Enter Share Code');
    const form = input.closest('form')!;
    
    // Type a complete code
    fireEvent.change(input, { target: { value: 'ABCD1234EFGH' } });
    
    // Submit the form
    fireEvent.submit(form);
    
    // Check that onSubmit was called with the sanitized code
    expect(mockOnSubmit).toHaveBeenCalledWith('ABCD1234EFGH');
  });
  
  it('displays loading state when loading prop is true', () => {
    render(<CodeInput onSubmit={mockOnSubmit} loading={true} />);
    
    // Check for loading indicator
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    
    // Check that the submit button is disabled
    expect(screen.getByRole('button', { name: 'Connecting...' })).toBeDisabled();
  });
  
  it('displays error message when error prop is provided', () => {
    const errorMessage = 'Invalid code. Please try again.';
    render(<CodeInput onSubmit={mockOnSubmit} error={errorMessage} />);
    
    // Check for error message
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});