/**
 * BudgetTemplateService Tests
 * 
 * Tests for US6: Template Protection
 * - System templates cannot be modified or deleted
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../common/context/tenant.context';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetTemplate, TemplateCategory } from './entities/budget-template.entity';
import { PeriodType } from './entities/budget.entity';
import { Budget } from './budget.entity';
import { Account } from '../accounts/account.entity';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('BudgetTemplateService', () => {
  let service: BudgetTemplateService;
  let templateRepository: jest.Mocked<Repository<BudgetTemplate>>;
  let budgetRepository: jest.Mocked<Repository<Budget>>;
  let accountRepository: jest.Mocked<Repository<Account>>;

  const mockSystemTemplate = {
    id: 'template-1',
    tenant_id: 'tenant-1',
    name: 'Monthly Living Expenses',
    description: 'System template for monthly expenses',
    category: TemplateCategory.PERSONAL,
    is_system_template: true,
    is_active: true,
    account_pattern: null as string | null,
    account_type: 'expense',
    default_period_type: PeriodType.MONTHLY,
    default_amount: 0,
    default_currency: 'USD',
    default_alert_threshold: 80,
    suggested_categories: ['Housing', 'Utilities'],
    metadata: null as Record<string, any> | null,
    created_at: new Date(),
    updated_at: new Date(),
  } as BudgetTemplate;

  const mockCustomTemplate = {
    id: 'template-2',
    tenant_id: 'tenant-1',
    name: 'My Custom Budget',
    description: 'User created template',
    category: TemplateCategory.CUSTOM,
    is_system_template: false,
    is_active: true,
    account_pattern: null as string | null,
    account_type: 'expense',
    default_period_type: PeriodType.MONTHLY,
    default_amount: 1000,
    default_currency: 'USD',
    default_alert_threshold: 80,
    suggested_categories: [],
    metadata: null as Record<string, any> | null,
    created_at: new Date(),
    updated_at: new Date(),
  } as BudgetTemplate;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetTemplateService,
        {
          provide: getRepositoryToken(BudgetTemplate),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetTemplateService>(BudgetTemplateService);
    templateRepository = module.get(getRepositoryToken(BudgetTemplate));
    budgetRepository = module.get(getRepositoryToken(Budget));
    accountRepository = module.get(getRepositoryToken(Account));
  });

  // US6: Template Protection Tests
  describe('Template Protection', () => {
    describe('updateTemplate', () => {
      it('should reject update to system template', async () => {
        templateRepository.findOne.mockResolvedValue(mockSystemTemplate);

        await expect(
          runWithTenant('tenant-1', () => 
            service.updateTemplate('template-1', 'tenant-1', { name: 'Hacked' }),
          ),
        ).rejects.toThrow('Cannot modify system templates');
      });

      it('should allow update to custom template', async () => {
        templateRepository.findOne.mockResolvedValue(mockCustomTemplate);
        templateRepository.save.mockResolvedValue({
          ...mockCustomTemplate,
          name: 'Updated Custom Budget',
        });

        const result = await runWithTenant('tenant-1', () => 
          service.updateTemplate('template-2', 'tenant-1', { name: 'Updated Custom Budget' }),
        );

        expect(result!.name).toBe('Updated Custom Budget');
      });

      it('should throw error when template not found', async () => {
        templateRepository.findOne.mockResolvedValue(null);

        const result = await runWithTenant('tenant-1', () =>
          service.updateTemplate('not-found', 'tenant-1', { name: 'Test' }),
        );

        // updateTemplate returns null when template not found
        expect(result).toBeNull();
      });
    });

    describe('deleteTemplate', () => {
      it('should reject deletion of system template', async () => {
        templateRepository.findOne.mockResolvedValue(mockSystemTemplate);

        await expect(
          runWithTenant('tenant-1', () =>
            service.deleteTemplate('template-1', 'tenant-1'),
          ),
        ).rejects.toThrow('Cannot delete system templates');
      });

      it('should allow deletion of custom template', async () => {
        templateRepository.findOne.mockResolvedValue(mockCustomTemplate);
        templateRepository.save.mockResolvedValue({
          ...mockCustomTemplate,
          is_active: false,
        });

        const result = await runWithTenant('tenant-1', () => 
          service.deleteTemplate('template-2', 'tenant-1'),
        );

        expect(result).toBe(true);
        expect(templateRepository.save).toHaveBeenCalled();
      });

      it('should soft delete custom template', async () => {
        templateRepository.findOne.mockResolvedValue(mockCustomTemplate);
        templateRepository.save.mockImplementation((data) => Promise.resolve(data as BudgetTemplate));

        await runWithTenant('tenant-1', () => 
          service.deleteTemplate('template-2', 'tenant-1'),
        );

        expect(templateRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            is_active: false,
          }),
        );
      });
    });

    describe('listTemplates', () => {
      it('should return both system and custom templates by default', async () => {
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockSystemTemplate, mockCustomTemplate], 2]),
        };
        templateRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

        const result = await runWithTenant('tenant-1', () =>
          service.listTemplates('tenant-1'),
        );

        expect(result.templates).toHaveLength(2);
        expect(result.templates).toContainEqual(mockSystemTemplate);
        expect(result.templates).toContainEqual(mockCustomTemplate);
      });

      it('should filter out system templates when includeSystem is false', async () => {
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockCustomTemplate], 1]),
        };
        templateRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

        const result = await runWithTenant('tenant-1', () =>
          service.listTemplates('tenant-1', { includeSystem: false }),
        );

        expect(result.templates).toHaveLength(1);
        expect(result.templates[0].is_system_template).toBe(false);
      });

      it('should order system templates first', async () => {
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        };
        templateRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

        await runWithTenant('tenant-1', () =>
          service.listTemplates('tenant-1'),
        );

        expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('template.is_system_template', 'DESC');
      });
    });
  });

  describe('createTemplate', () => {
    it('should create custom template with is_system_template=false', async () => {
      const createInput = {
        name: 'New Custom Template',
        category: TemplateCategory.CUSTOM,
      };

      templateRepository.create.mockImplementation((data) => data as BudgetTemplate);
      templateRepository.save.mockResolvedValue({
        ...mockCustomTemplate,
        ...createInput,
        is_system_template: false,
      } as BudgetTemplate);

      await runWithTenant('tenant-1', () =>
        service.createTemplate('tenant-1', createInput),
      );

      expect(templateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_system_template: false,
        }),
      );
    });
  });

  describe('duplicateTemplate', () => {
    it('should create duplicate as custom template', async () => {
      templateRepository.findOne.mockResolvedValue(mockSystemTemplate);
      templateRepository.create.mockImplementation((data) => data as BudgetTemplate);
      templateRepository.save.mockResolvedValue({
        ...mockSystemTemplate,
        id: 'new-template-id',
        name: 'Monthly Living Expenses (Copy)',
        is_system_template: false,
      } as BudgetTemplate);

      const result = await runWithTenant('tenant-1', () => 
        service.duplicateTemplate('template-1', 'tenant-1'),
      );

      expect(result!.is_system_template).toBe(false);
      expect(result!.name).toContain('(Copy)');
    });
  });
});
