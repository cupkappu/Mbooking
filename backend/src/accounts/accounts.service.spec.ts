import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { Account, AccountType } from './account.entity';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepository: any;

  const mockAccount: Account = {
    id: 'uuid-1',
    tenant_id: 'tenant-1',
    parent: null,
    children: [],
    name: 'Bank',
    type: AccountType.ASSETS,
    currency: 'USD',
    path: 'assets:bank',
    depth: 1,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
            findTrees: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            findDescendants: jest.fn(() => Promise.resolve([])),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            }),
            manager: {
              save: jest.fn((account) => Promise.resolve(account)),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    accountRepository = module.get(getRepositoryToken(Account)) as any;
  });

  describe('findAll', () => {
    it('should return all active accounts for tenant', async () => {
      const mockAccounts = [mockAccount];
      accountRepository.find.mockResolvedValue(mockAccounts);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual(mockAccounts);
      expect(accountRepository.find).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1', is_active: true },
        order: { path: 'ASC' },
      });
    });

    it('should return empty array when no accounts', async () => {
      accountRepository.find.mockResolvedValue([]);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return account when found', async () => {
      accountRepository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findById('uuid-1', 'tenant-1');

      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('not-found', 'tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create top-level account', async () => {
      const createdAccount = {
        ...mockAccount,
        tenant_id: 'tenant-1',
        path: 'Bank',
        depth: 0,
      };
      accountRepository.create.mockReturnValue(createdAccount);
      accountRepository.save.mockResolvedValue(createdAccount);

      const result = await service.create(
        {
          name: 'Bank',
          type: AccountType.ASSETS,
          currency: 'USD',
        },
        'tenant-1',
      );

      expect(result).toBeDefined();
      expect(result.path).toBe('Bank');
      expect(result.depth).toBe(0);
    });

    it('should create child account with correct path', async () => {
      const parentAccount = { ...mockAccount, path: 'assets', depth: 0 };
      const childAccount = {
        ...mockAccount,
        parent: parentAccount as Account,
        path: 'assets:bank',
        depth: 1,
      };

      accountRepository.findOne.mockResolvedValue(parentAccount);
      accountRepository.create.mockReturnValue(childAccount);
      accountRepository.save.mockResolvedValue(childAccount);

      const result = await service.create(
        {
          name: 'bank',
          type: AccountType.ASSETS,
          currency: 'USD',
          parent_id: 'uuid-1',
        } as any,
        'tenant-1',
      );

      expect(result.path).toBe('assets:bank');
      expect(result.depth).toBe(1);
    });
  });

  describe('update', () => {
    it('should update account name and path', async () => {
      const updatedAccount = { ...mockAccount, name: 'Updated Bank', path: 'assets:updated-bank' };
      accountRepository.findOne.mockResolvedValueOnce(mockAccount)

      accountRepository.save.mockResolvedValue(updatedAccount);

      const result = await service.update(
        'uuid-1',
        { name: 'Updated Bank' },
        'tenant-1',
      );

      expect(result.name).toBe('Updated Bank');
    });
  });

  describe('delete', () => {
    it('should throw BadRequestException when account has children', async () => {
      const accountWithChildren = { ...mockAccount, children: [{} as Account] };
      const childAccount = { ...mockAccount, id: 'uuid-2', parent: mockAccount as Account };
      accountRepository.findOne.mockResolvedValue(accountWithChildren);
      (accountRepository.findDescendants as jest.Mock).mockResolvedValue([mockAccount, childAccount]);

      await expect(service.delete('uuid-1', 'tenant-1')).rejects.toThrow(BadRequestException);
    });

    it('should remove account when no children', async () => {
      accountRepository.findOne.mockResolvedValue(mockAccount);
      accountRepository.remove.mockResolvedValue(mockAccount);

      await service.delete('uuid-1', 'tenant-1');

      expect(accountRepository.remove).toHaveBeenCalledWith(mockAccount);
    });
  });
});
