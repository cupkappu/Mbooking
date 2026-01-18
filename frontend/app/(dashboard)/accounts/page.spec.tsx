import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AccountsPage from './page';
import { useAccounts, useCreateAccount, useBalances } from '@/hooks/use-api';
import { currenciesApi } from '@/lib/currencies';

jest.mock('@/hooks/use-api');
jest.mock('@/lib/currencies');

const mockAccounts = [
  {
    id: '1',
    name: 'Assets',
    type: 'assets',
    currency: 'USD',
    path: 'assets',
    depth: 0,
    parent_id: null,
  },
  {
    id: '2',
    name: 'Cash',
    type: 'assets',
    currency: 'USD',
    path: 'assets:cash',
    depth: 1,
    parent_id: '1',
  },
  {
    id: '3',
    name: 'Bank',
    type: 'assets',
    currency: 'USD',
    path: 'assets:bank',
    depth: 1,
    parent_id: '1',
  },
];

const mockBalances = {
  balances: [
    {
      account: mockAccounts[0],
      currencies: [{ currency: 'USD', amount: 1000 }],
      converted_amount: 1000,
      subtree_currencies: [{ currency: 'USD', amount: 2500 }],
      converted_subtree_total: 2500,
      converted_subtree_currency: 'USD',
    },
    {
      account: mockAccounts[1],
      currencies: [{ currency: 'USD', amount: 500 }],
      converted_amount: 500,
      subtree_currencies: [{ currency: 'USD', amount: 500 }],
      converted_subtree_total: 500,
      converted_subtree_currency: 'USD',
    },
    {
      account: mockAccounts[2],
      currencies: [{ currency: 'USD', amount: 2000 }],
      converted_amount: 2000,
      subtree_currencies: [{ currency: 'USD', amount: 2000 }],
      converted_subtree_total: 2000,
      converted_subtree_currency: 'USD',
    },
  ],
};

const mockCurrencies = [
  { id: '1', code: 'USD', name: 'US Dollar', symbol: '$', is_active: true, is_default: true },
  { id: '2', code: 'EUR', name: 'Euro', symbol: '€', is_active: true, is_default: false },
];

describe('AccountsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useAccounts as jest.Mock).mockReturnValue({
      data: mockAccounts,
      isLoading: false,
      refetch: jest.fn(),
    });

    (useBalances as jest.Mock).mockReturnValue({
      data: mockBalances,
      isLoading: false,
      refetch: jest.fn(),
    });

    (useCreateAccount as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (currenciesApi.getAll as jest.Mock).mockResolvedValue(mockCurrencies);
  });

  describe('Rendering', () => {
    it('should render accounts page with account tree', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const accountsTitle = screen.getByText('Accounts');
      expect(accountsTitle).toBeTruthy();
    });

    it('should show accounts in the tree', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const assetsAccount = screen.getByText('Assets');
      expect(assetsAccount).toBeTruthy();
    });

    it('should show subtree balance toggle switch', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const toggleLabel = screen.getByText('Show Subtree Balances');
      expect(toggleLabel).toBeTruthy();
    });

    it('should display currency selector', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const currencyLabel = screen.getByText('Display Currency:');
      expect(currencyLabel).toBeTruthy();
    });

    it('should show New Account button', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const newAccountButton = screen.getByText('New Account');
      expect(newAccountButton).toBeTruthy();
    });

    it('should show Account Tree card', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const accountTreeCard = screen.getByText('Account Tree');
      expect(accountTreeCard).toBeTruthy();
    });

    it('should show currency options in selector', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      await waitFor(() => {
        const usdOption = screen.getByRole('option', { name: 'USD' });
        const eurOption = screen.getByRole('option', { name: 'EUR' });
        expect(usdOption).toBeTruthy();
        expect(eurOption).toBeTruthy();
      });
    });
  });

  describe('Loading States', () => {
    it('should display loading state when accounts are loading', async () => {
      (useAccounts as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        refetch: jest.fn(),
      });

      await act(async () => {
        render(<AccountsPage />);
      });

      const loadingText = screen.getByText('Loading accounts...');
      expect(loadingText).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no accounts exist', async () => {
      (useAccounts as jest.Mock).mockReturnValue({
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      });

      await act(async () => {
        render(<AccountsPage />);
      });

      const emptyMessage = screen.getByText('No accounts yet. Create your first account to get started.');
      expect(emptyMessage).toBeTruthy();
    });
  });

  describe('Toggle Interaction', () => {
    it('should toggle the subtree balance switch', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const toggle = screen.getByLabelText('Show Subtree Balances');
      expect(toggle).toBeTruthy();

      const toggleInput = toggle as HTMLInputElement;
      expect(toggleInput.checked).toBe(false);

      fireEvent.click(toggle);
      expect(toggleInput.checked).toBe(true);
    });
  });

  describe('Currency Selection', () => {
    it('should have currency options available', async () => {
      await act(async () => {
        render(<AccountsPage />);
      });

      const currencySelect = screen.getByRole('combobox');
      expect(currencySelect).toBeTruthy();
    });
  });
});
