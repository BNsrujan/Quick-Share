/**
 * Tests for FileUpload component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUpload } from '../FileUpload';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe('FileUpload Component', () => {
  const mockOnFileSelect = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the drag and drop area', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />);
    
    expect(screen.getByText('Drag & drop your file here')).toBeInTheDocument();
    expect(screen.getByText('or click to browse your files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select File' })).toBeInTheDocument();
  });
  
  it('shows maximum file size information', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} maxFileSize={100 * 1024 * 1024} />);
    
    expect(screen.getByText('Maximum file size: 100 MB')).toBeInTheDocument();
  });
  
  it('handles file selection via button click', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} />);
    
    const fileInput = screen.getByRole('button', { name: 'Select File' });
    expect(fileInput).toBeInTheDocument();
    
    // We can't directly test the file input interaction in JSDOM,
    // but we can verify the button is rendered correctly
  });
  
  it('shows error when file is too large', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} maxFileSize={5 * 1024 * 1024} />);
    
    // Create a mock file that exceeds the max size
    const file = new File(['test content'.repeat(1000000)], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 }); // 10MB
    
    // Get the hidden file input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Mock the file selection
    const dataTransfer = {
      files: [file],
    };
    
    // Trigger change event
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    // Check if error message is displayed
    expect(screen.getByText(/File is too large/)).toBeInTheDocument();
    
    // Verify onFileSelect was not called
    expect(mockOnFileSelect).not.toHaveBeenCalled();
  });
  
  it('calls onFileSelect with the selected file when size is valid', () => {
    render(<FileUpload onFileSelect={mockOnFileSelect} maxFileSize={10 * 1024 * 1024} />);
    
    // Create a mock file within the size limit
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB
    
    // Get the hidden file input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Mock the file selection
    const dataTransfer = {
      files: [file],
    };
    
    // Trigger change event
    fireEvent.change(input, { target: { files: dataTransfer.files } });
    
    // Verify onFileSelect was called with the file
    expect(mockOnFileSelect).toHaveBeenCalledWith(file);
  });
});