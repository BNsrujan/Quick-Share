/**
 * Tests for AppShell component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../AppShell';

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe('AppShell Component', () => {
  it('renders the header with logo and navigation', () => {
    render(<AppShell>Test Content</AppShell>);
    
    // Check for logo and title
    expect(screen.getByAltText('Quick-Share Logo')).toBeInTheDocument();
    expect(screen.getByText('Quick-Share P2P')).toBeInTheDocument();
    
    // Check for navigation links
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Receive')).toBeInTheDocument();
  });
  
  it('renders children content', () => {
    render(<AppShell>Test Content</AppShell>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
  
  it('renders footer with copyright text', () => {
    render(<AppShell>Test Content</AppShell>);
    expect(screen.getByText(/Quick-Share P2P • Secure • Fast • Private/)).toBeInTheDocument();
  });
  
  it('shows mobile menu when menu button is clicked', () => {
    render(<AppShell>Test Content</AppShell>);
    
    // Mobile menu should be hidden initially
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    
    // Click the menu button
    const menuButton = screen.getByLabelText('Menu');
    fireEvent.click(menuButton);
    
    // Mobile menu should now be visible
    expect(screen.getAllByRole('menuitem').length).toBe(3);
    expect(screen.getByRole('menuitem', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Receive' })).toBeInTheDocument();
  });
});