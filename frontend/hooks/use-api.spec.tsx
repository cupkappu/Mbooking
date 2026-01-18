// Unmock @tanstack/react-query for this test
jest.unmock('@tanstack/react-query');

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBalances } from './use-api';

jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api';

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0, // Immediately garbage collect
    },
  },
});

// Mock the apiClient
jest.mock('@/lib/api', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

// Helper to wrap components with QueryClientProvider
const wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
};

describe('use-api hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useBalances', () => {
    it('should call the API with include_subtree parameter when provided', async () => {
      const mockBalances = {
        balances: [
          {
            account: {
              id: 'test-account',
              name: 'Test Account',
              type: 'assets',
              currency: 'USD',
              path: '0',
              depth: 0,
            },
            currencies: [{ currency: 'USD', amount: 100 }],
            subtree_currencies: [{ currency: 'USD', amount: 200 }],
            converted_subtree_total: 200,
            converted_subtree_currency: 'USD',
          },
        ],
      };

      (apiClient.post as jest.MockedFunction<typeof apiClient.post>).mockResolvedValue(mockBalances);

      renderHook(() => 
        useBalances({ include_subtree: true })
      , { wrapper });

      // Wait for the query to execute
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/api/v1/query/balances',
          { include_subtree: true }
        );
      });
    });

    it('should call the API without include_subtree parameter when not provided', async () => {
      const mockBalances = {
        balances: [
          {
            account: {
              id: 'test-account',
              name: 'Test Account',
              type: 'assets',
              currency: 'USD',
              path: '0',
              depth: 0,
            },
            currencies: [{ currency: 'USD', amount: 100 }],
          },
        ],
      };

      (apiClient.post as jest.MockedFunction<typeof apiClient.post>).mockResolvedValue(mockBalances);

      renderHook(() => 
        useBalances({})
      , { wrapper });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/api/v1/query/balances',
          {}
        );
      });
    });

    it('should work with all query parameters including include_subtree', async () => {
      const mockBalances = {
        balances: [
          {
            account: {
              id: 'test-account',
              name: 'Test Account',
              type: 'assets',
              currency: 'USD',
              path: '0',
              depth: 0,
            },
            currencies: [{ currency: 'USD', amount: 100 }],
            subtree_currencies: [{ currency: 'USD', amount: 300 }],
            converted_subtree_total: 300,
            converted_subtree_currency: 'USD',
          },
        ],
      };

      (apiClient.post as jest.MockedFunction<typeof apiClient.post>).mockResolvedValue(mockBalances);

      const query = {
        depth: 2,
        convert_to: 'EUR',
        date_range: { from: '2023-01-01', to: '2023-12-31' },
        include_subtree: true,
      };

      renderHook(() => 
        useBalances(query)
      , { wrapper });

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/api/v1/query/balances',
          query
        );
      });
    });
  });
});