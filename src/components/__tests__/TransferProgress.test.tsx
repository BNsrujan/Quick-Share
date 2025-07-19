/**
 * Tests for TransferProgress component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransferProgress } from '../TransferProgress';
import { TransferState } from '../../types/transfer';

describe('TransferProgress Component', () => {
  const mockOnPause = jest.fn();
  const mockOnResume = jest.fn();
  const mockOnCancel = jest.fn();
  
  // Mock transfer state for testing
  const createMockTransfer = (status: TransferState['status']): TransferState => ({
    id: 'test-transfer-id',
    status,
    file: {
      name: 'test-file.pdf',
      size: 5 * 1024 * 1024, // 5MB
      type: 'application/pdf',
      hash: 'test-hash',
    },
    progress: {
      bytesTransferred: 2.5 * 1024 * 1024, // 2.5MB
      totalBytes: 5 * 1024 * 1024, // 5MB
      percentage: 50,
      speed: 1024 * 1024, // 1MB/s
      eta: 2.5, // 2.5 seconds
    },
    chunks: {
      total: 10,
      completed: [0, 1, 2, 3, 4],
      failed: [],
      inProgress: [5],
    },
    connection: {
      peerId: 'test-peer-id',
      channels: [] as RTCDataChannel[],
      quality: 'good',
    },
    encryption: {
      keyId: 'test-key-id',
      algorithm: 'AES-256-GCM',
    },
    timestamps: {
      created: new Date(),
      started: new Date(),
    },
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders file name and size', () => {
    const mockTransfer = createMockTransfer('transferring');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('test-file.pdf')).toBeInTheDocument();
    expect(screen.getByText('5 MB')).toBeInTheDocument();
  });
  
  it('displays correct status text', () => {
    const mockTransfer = createMockTransfer('transferring');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('Transferring')).toBeInTheDocument();
  });
  
  it('shows progress percentage', () => {
    const mockTransfer = createMockTransfer('transferring');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });
  
  it('shows transfer speed and ETA when transferring', () => {
    const mockTransfer = createMockTransfer('transferring');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.getByText('1.0 MB/s')).toBeInTheDocument();
    expect(screen.getByText('3s remaining')).toBeInTheDocument();
  });
  
  it('shows pause button when transfer is in progress', () => {
    const mockTransfer = createMockTransfer('transferring');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    expect(pauseButton).toBeInTheDocument();
    
    // Click pause button
    fireEvent.click(pauseButton);
    expect(mockOnPause).toHaveBeenCalled();
  });
  
  it('shows resume button when transfer is paused', () => {
    const mockTransfer = createMockTransfer('paused');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    const resumeButton = screen.getByRole('button', { name: 'Resume' });
    expect(resumeButton).toBeInTheDocument();
    
    // Click resume button
    fireEvent.click(resumeButton);
    expect(mockOnResume).toHaveBeenCalled();
  });
  
  it('shows cancel button when transfer is not completed', () => {
    const mockTransfer = createMockTransfer('transferring');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
    
    // Click cancel button
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });
  
  it('does not show control buttons when transfer is completed', () => {
    const mockTransfer = createMockTransfer('completed');
    render(
      <TransferProgress
        transfer={mockTransfer}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onCancel={mockOnCancel}
      />
    );
    
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});