/**
 * Tests for ShareCode component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareCode } from '../ShareCode';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve()),
  },
});

describe('ShareCode Component', () => {
  const mockCode = 'ABCD1234EFGH';
  const mockOnCopy = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the share code with proper formatting', () => {
    render(<ShareCode code={mockCode} />);
    
    // Check for formatted code (with spaces)
    expect(screen.getByText('ABCD 1234 EFGH')).toBeInTheDocument();
    
    // Check for instructions
    expect(screen.getByText('Share this code to connect')).toBeInTheDocument();
    expect(screen.getByText('This code will expire once the transfer is complete')).toBeInTheDocument();
  });
  
  it('renders the QR code image', () => {
    render(<ShareCode code={mockCode} />);
    
    // Check for QR code image
    const qrCodeImage = screen.getByAltText('QR Code');
    expect(qrCodeImage).toBeInTheDocument();
    
    // Check that the QR code URL contains the code
    expect(qrCodeImage.getAttribute('src')).toContain(mockCode);
  });
  
  it('copies code to clipboard when copy button is clicked', async () => {
    render(<ShareCode code={mockCode} onCopy={mockOnCopy} />);
    
    // Find and click the copy button
    const copyButton = screen.getByText('Copy Code');
    fireEvent.click(copyButton);
    
    // Check that clipboard API was called with the code
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
    
    // Check that onCopy callback was called
    expect(mockOnCopy).toHaveBeenCalled();
    
    // Check that button text changes to "Copied!"
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
    
    // Check that button text reverts back after timeout
    jest.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText('Copy Code')).toBeInTheDocument();
    });
  });
});