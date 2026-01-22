import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupForm } from './setup-form';
import { useSetup } from '@/hooks/use-setup';

// Mock useSetup hook
jest.mock('@/hooks/use-setup', () => ({
  useSetup: jest.fn(() => ({
    isLoading: false,
    error: null,
    initialize: jest.fn(),
    redirectToDashboard: jest.fn(),
    redirectToLogin: jest.fn(),
    checkStatus: jest.fn(),
    clearError: jest.fn(),
  })),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

describe('SetupForm', () => {
  const mockInitialize = jest.fn();
  const mockRedirectToDashboard = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSetup as jest.Mock).mockReturnValue({
      isLoading: false,
      error: null,
      initialize: mockInitialize,
      redirectToDashboard: mockRedirectToDashboard,
      redirectToLogin: jest.fn(),
      checkStatus: jest.fn(),
      clearError: mockClearError,
    });
    localStorage.clear();
  });

  describe('Form Rendering', () => {
    it('should render initialization secret input', () => {
      render(<SetupForm />);

      expect(screen.getByLabelText('Initialization Secret')).toBeInTheDocument();
    });

    it('should render email input', () => {
      render(<SetupForm />);

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('should render name input', () => {
      render(<SetupForm />);

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(<SetupForm />);

      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should render organization name input', () => {
      render(<SetupForm />);

      expect(screen.getByLabelText('Organization Name (Optional)')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<SetupForm />);

      expect(screen.getByRole('button', { name: 'Initialize System' })).toBeInTheDocument();
    });

    it('should render form description', () => {
      render(<SetupForm />);

      expect(screen.getByText('Create your administrator account to initialize the system')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show email validation error for invalid email', async () => {
      render(<SetupForm />);

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show password length error for short password', async () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
      });
    });

    it('should show password uppercase error when missing uppercase', async () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'lowercase123!' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least 1 uppercase letter')).toBeInTheDocument();
      });
    });

    it('should show password lowercase error when missing lowercase', async () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'UPPERCASE123!' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least 1 lowercase letter')).toBeInTheDocument();
      });
    });

    it('should show password number error when missing number', async () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'NoNumbersHere!' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least 1 number')).toBeInTheDocument();
      });
    });

    it('should show password special character error when missing special char', async () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'NoSpecialChar123' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least 1 special character (!@#$%^&*)')).toBeInTheDocument();
      });
    });

    it('should show name required error when name is empty', async () => {
      render(<SetupForm />);

      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: '' } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });
  });

  describe('Password Strength Indicators', () => {
    it('should show password strength indicators when typing', () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123!' } });

      expect(screen.getByText('✓ At least 12 characters')).toBeInTheDocument();
      expect(screen.getByText('✓ 1 uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('✓ 1 lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('✓ 1 number')).toBeInTheDocument();
      expect(screen.getByText('✓ 1 special character (!@#$%^&*)')).toBeInTheDocument();
    });

    it('should show empty circles for unmet password requirements', () => {
      render(<SetupForm />);

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'weak' } });

      expect(screen.getByText('○ At least 12 characters')).toBeInTheDocument();
      expect(screen.getByText('○ 1 uppercase letter')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should show error when INIT_SECRET is missing', async () => {
      render(<SetupForm />);

      const submitButton = screen.getByRole('button', { name: 'Initialize System' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter the initialization secret')).toBeInTheDocument();
      });
      expect(mockInitialize).not.toHaveBeenCalled();
    });

    it('should call initialize with correct data when form is submitted', async () => {
      render(<SetupForm />);

      const secretInput = screen.getByLabelText('Initialization Secret');
      fireEvent.change(secretInput, { target: { value: 'test-secret' } });

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Administrator' } });

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123!' } });

      const submitButton = screen.getByRole('button', { name: 'Initialize System' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalledWith(
          {
            email: 'admin@example.com',
            name: 'Administrator',
            password: 'SecureP@ss123!',
            organizationName: '',
          },
          'test-secret'
        );
      });
    });

    it('should store INIT_SECRET in localStorage on successful submission', async () => {
      mockInitialize.mockResolvedValue({
        success: true,
        message: 'System initialized successfully',
        user: { id: '123', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      });

      render(<SetupForm />);

      const secretInput = screen.getByLabelText('Initialization Secret');
      fireEvent.change(secretInput, { target: { value: 'test-secret' } });

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Administrator' } });

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123!' } });

      const submitButton = screen.getByRole('button', { name: 'Initialize System' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(localStorage.getItem('initSecret')).toBe('test-secret');
      });
    });

    it('should redirect to dashboard on successful initialization', async () => {
      mockInitialize.mockResolvedValue({
        success: true,
        message: 'System initialized successfully',
        user: { id: '123', email: 'admin@example.com', name: 'Admin', role: 'admin' },
      });

      render(<SetupForm />);

      const secretInput = screen.getByLabelText('Initialization Secret');
      fireEvent.change(secretInput, { target: { value: 'test-secret' } });

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Administrator' } });

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123!' } });

      const submitButton = screen.getByRole('button', { name: 'Initialize System' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRedirectToDashboard).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error message when initialization fails', async () => {
      mockInitialize.mockRejectedValue(new Error('Initialization failed'));

      render(<SetupForm />);

      const secretInput = screen.getByLabelText('Initialization Secret');
      fireEvent.change(secretInput, { target: { value: 'test-secret' } });

      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });

      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Administrator' } });

      const passwordInput = screen.getByLabelText('Password');
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123!' } });

      const submitButton = screen.getByRole('button', { name: 'Initialize System' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Initialization failed')).toBeInTheDocument();
      });
    });

    it('should disable submit button when loading', () => {
      (useSetup as jest.Mock).mockReturnValue({
        isLoading: true,
        error: null,
        initialize: jest.fn(),
        redirectToDashboard: jest.fn(),
        redirectToLogin: jest.fn(),
        checkStatus: jest.fn(),
        clearError: jest.fn(),
      });

      render(<SetupForm />);

      const submitButton = screen.getByRole('button', { name: 'Initializing...' });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('INIT_SECRET Persistence', () => {
    it('should load INIT_SECRET from localStorage on mount', () => {
      localStorage.setItem('initSecret', 'stored-secret');

      render(<SetupForm />);

      const secretInput = screen.getByLabelText('Initialization Secret') as HTMLInputElement;
      expect(secretInput.value).toBe('stored-secret');
    });

    it('should clear secret error when user types in secret field', () => {
      (useSetup as jest.Mock).mockReturnValue({
        isLoading: false,
        error: 'Some error',
        initialize: jest.fn(),
        redirectToDashboard: jest.fn(),
        redirectToLogin: jest.fn(),
        checkStatus: jest.fn(),
        clearError: mockClearError,
      });

      render(<SetupForm />);

      const secretInput = screen.getByLabelText('Initialization Secret');
      fireEvent.change(secretInput, { target: { value: 'new-secret' } });

      expect(mockClearError).toHaveBeenCalled();
    });
  });
});
