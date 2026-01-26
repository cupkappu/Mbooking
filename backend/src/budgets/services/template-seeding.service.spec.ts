/**
 * TemplateSeedingService Tests
 * 
 * Tests for US4: System Template Seeding
 * - FR-C011: New tenants get 8 system templates automatically
 * - Idempotency check to prevent duplicate templates
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../common/context/tenant.context';
import { TemplateSeedingService } from './template-seeding.service';
import { BudgetTemplate, TemplateCategory, SYSTEM_BUDGET_TEMPLATES } from '../entities/budget-template.entity';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('TemplateSeedingService', () => {
  let service: TemplateSeedingService;
  let templateRepository: jest.Mocked<Repository<BudgetTemplate>>;

  const mockTemplate = {
    id: 'template-1',
    tenant_id: 'tenant-1',
    name: 'Monthly Living Expenses',
    description: 'Template for tracking monthly living expenses',
    category: TemplateCategory.PERSONAL,
    is_system_template: true,
    is_active: true,
    account_pattern: '',
    account_type: 'expense',
    default_period_type: 'monthly' as any,
    default_amount: 0,
    default_currency: 'USD',
    default_alert_threshold: 80,
    suggested_categories: ['Housing', 'Utilities'],
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateSeedingService,
        {
          provide: getRepositoryToken(BudgetTemplate),
          useValue: {
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TemplateSeedingService>(TemplateSeedingService);
    templateRepository = module.get(getRepositoryToken(BudgetTemplate));
  });

  describe('seedSystemTemplates', () => {
    // FR-C011: New tenants get 8 system templates automatically
    it('should create all system templates when none exist', async () => {
      templateRepository.findOne.mockResolvedValue(null);
      templateRepository.create.mockImplementation((data) => data as BudgetTemplate);
      templateRepository.save.mockResolvedValue(mockTemplate);

      const result = await runWithTenant('tenant-1', () => service.seedSystemTemplates());

      expect(result.created).toBe(SYSTEM_BUDGET_TEMPLATES.length);
      expect(result.skipped).toBe(0);
      expect(templateRepository.save).toHaveBeenCalledTimes(SYSTEM_BUDGET_TEMPLATES.length);
    });

    it('should skip existing templates', async () => {
      templateRepository.findOne.mockResolvedValue(mockTemplate); // Template exists

      const result = await runWithTenant('tenant-1', () => service.seedSystemTemplates());

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(SYSTEM_BUDGET_TEMPLATES.length);
      // save should not be called for existing templates
      expect(templateRepository.save).not.toHaveBeenCalled();
    });

    it('should mix created and skipped templates', async () => {
      let callCount = 0;
      templateRepository.findOne.mockImplementation(() => {
        callCount++;
        // First call returns null (create), rest return existing (skip)
        return Promise.resolve(callCount === 1 ? null : mockTemplate);
      });
      templateRepository.create.mockImplementation((data) => data as BudgetTemplate);
      templateRepository.save.mockResolvedValue(mockTemplate);

      const result = await runWithTenant('tenant-1', () => service.seedSystemTemplates());

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(SYSTEM_BUDGET_TEMPLATES.length - 1);
    });
  });

  describe('getSystemTemplateCount', () => {
    it('should return count of system templates', async () => {
      templateRepository.count.mockResolvedValue(8);

      const count = await runWithTenant('tenant-1', () => service.getSystemTemplateCount('tenant-1'));

      expect(count).toBe(8);
      expect(templateRepository.count).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          is_system_template: true,
          is_active: true,
        },
      });
    });
  });

  describe('verifyAllTemplatesExist', () => {
    it('should return true when all templates exist', async () => {
      templateRepository.count.mockResolvedValue(SYSTEM_BUDGET_TEMPLATES.length);

      const result = await runWithTenant('tenant-1', () => service.verifyAllTemplatesExist('tenant-1'));

      expect(result).toBe(true);
    });

    it('should return false when templates are missing', async () => {
      templateRepository.count.mockResolvedValue(5); // Less than 8

      const result = await runWithTenant('tenant-1', () => service.verifyAllTemplatesExist('tenant-1'));

      expect(result).toBe(false);
    });
  });

  describe('seedIfNeeded', () => {
    it('should return seeded: false when templates already exist', async () => {
      templateRepository.count.mockResolvedValue(SYSTEM_BUDGET_TEMPLATES.length);

      const result = await runWithTenant('tenant-1', () => service.seedIfNeeded());

      expect(result.seeded).toBe(false);
      expect(result.templatesCreated).toBe(0);
    });

    it('should seed templates when not already present', async () => {
      templateRepository.count.mockResolvedValue(0); // No templates
      templateRepository.findOne.mockResolvedValue(null);
      templateRepository.create.mockImplementation((data) => data as BudgetTemplate);
      templateRepository.save.mockResolvedValue(mockTemplate);

      const result = await runWithTenant('tenant-1', () => service.seedIfNeeded());

      expect(result.seeded).toBe(true);
      expect(result.templatesCreated).toBe(SYSTEM_BUDGET_TEMPLATES.length);
    });
  });

  describe('Idempotency', () => {
    it('should be safe to call multiple times', async () => {
      // First call creates templates
      templateRepository.findOne
        .mockResolvedValueOnce(null) // First template - create
        .mockResolvedValue(mockTemplate); // Rest - skip
      
      templateRepository.create.mockImplementation((data) => data as BudgetTemplate);
      templateRepository.save.mockResolvedValue(mockTemplate);

      // Call seed multiple times
      const result1 = await runWithTenant('tenant-1', () => service.seedSystemTemplates());
      const result2 = await runWithTenant('tenant-1', () => service.seedSystemTemplates());
      const result3 = await runWithTenant('tenant-1', () => service.seedSystemTemplates());

      // All calls should complete without errors
      expect(result1.created + result1.skipped).toBe(SYSTEM_BUDGET_TEMPLATES.length);
      expect(result2.created + result2.skipped).toBe(SYSTEM_BUDGET_TEMPLATES.length);
      expect(result3.created + result3.skipped).toBe(SYSTEM_BUDGET_TEMPLATES.length);
    });
  });
});
