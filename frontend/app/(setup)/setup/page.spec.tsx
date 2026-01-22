import { render, screen, waitFor } from '@testing-library/react';
import SetupPage from '@/app/(setup)/setup/page';
import { useSetup } from '@/hooks/use-setup';

// Mock useSetup hook
jest.mock('@/hooks/use-setup', () => ({
  useSetup: jest.fn(() => ({
    checkStatus: jest.fn(),
    redirectToLogin: jest.fn(),
  })),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

describe('SetupPage', () => {
  const mockCheckStatus = jest.fn();
  const mockRedirectToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSetup as jest.Mock).mockReturnValue({
      checkStatus: mockCheckStatus,
      redirectToLogin: mockRedirectToLogin,
    });
  });

  describe('Rendering', () => {
    it('should render setup page with loading state initially', () => {
      mockCheckStatus.mockImplementation(() => new Promise(() => {})); // Pending promise

      render(<SetupPage />);

      expect(screen.getByText('Checking system status...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render setup form after status check completes', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByText('System Setup')).toBeInTheDocument();
      });
    });

    it('should render initialization secret field', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Initialization Secret')).toBeInTheDocument();
      });
    });

    it('should render email input field', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
      });
    });

    it('should render name input field', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      });
    });

    it('should render password input field', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
      });
    });

    it('should render organization name input field', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Organization Name (Optional)')).toBeInTheDocument();
      });
    });

    it('should render submit button', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Initialize System' })).toBeInTheDocument();
      });
    });
  });

  describe('Status Check Behavior', () => {
    it('should call checkStatus on mount', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(mockCheckStatus).toHaveBeenCalledTimes(1);
      });
    });

    it('should redirect to login when system is already initialized', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: true, userCount: 1 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(mockRedirectToLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('should show setup form when system is not initialized', async () => {
      mockCheckStatus.mockResolvedValue({ initialized: false, userCount: 0 });

      render(<SetupPage />);

      await waitFor(() => {
        expect(screen.getByText('System Setup')).toBeInTheDocument();
        expect(mockRedirectToLogin).not.toHaveBeenCalled();
      });
    });

    it('should handle checkStatus error gracefully', async () => {
      mockCheckStatus.mockRejectedValue(new Error('Failed to check status'));

      render(<SetupPage />);

      await waitFor(() => {
        // Should still show the setup form even if status check fails
        expect(screen.getByText('System Setup')).toBeInTheDocument();
      });
    });
  });
});
