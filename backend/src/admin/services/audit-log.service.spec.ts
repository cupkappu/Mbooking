import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from '../entities/audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditLogRepository: jest.Mocked<Repository<AuditLog>>;

  const mockAuditLog: AuditLog = {
    id: 'log-uuid-1',
    tenant_id: 'tenant-uuid',
    user_id: 'user-uuid-1',
    action: 'admin.user.create',
    entity_type: 'user',
    entity_id: 'created-user-uuid',
    old_value: null,
    new_value: { email: 'test@example.com', name: 'Test User' },
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla/5.0',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const createMockQueryBuilder = () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    return queryBuilder;
  };

  beforeEach(async () => {
    const mockAuditLogRepo = {
      createQueryBuilder: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs with all filters', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditLog], 1]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({
        offset: 0,
        limit: 10,
        user_id: 'user-uuid-1',
        action: 'admin.user.create',
        entity_type: 'user',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
      });

      expect(result.logs).toEqual([mockAuditLog]);
      expect(result.total).toBe(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(5);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should use default pagination when options not provided', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.getAuditLogs();

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });

    it('should handle partial filters', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditLog], 1]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({
        user_id: 'user-uuid-1',
      });

      expect(result.logs).toEqual([mockAuditLog]);
      expect(result.total).toBe(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.user_id = :user_id', { user_id: 'user-uuid-1' });
    });

    it('should return empty result when no logs found', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({});

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle action with LIKE pattern', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditLog], 1]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.getAuditLogs({ action: 'admin.user' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.action LIKE :action', { action: '%admin.user%' });
    });
  });

  describe('exportAuditLogsToCsv', () => {
    it('should export audit logs to CSV format', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditLog], 1]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.exportAuditLogsToCsv({ limit: 10000 });

      expect(result).toContain('"ID"');
      expect(result).toContain('"User ID"');
      expect(result).toContain('"Action"');
      expect(result).toContain('"log-uuid-1"');
      expect(result).toContain('"user-uuid-1"');
      expect(result).toContain('"admin.user.create"');
      expect(result).toContain('"user"');
      expect(result).toContain('"127.0.0.1"');
    });

    it('should handle empty logs', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.exportAuditLogsToCsv({});

      expect(result).toContain('"ID"');
      expect(result).toContain('"User ID"');
      expect(result).toContain('"Action"');
      expect(result).toContain('"Entity Type"');
      expect(result).toContain('"IP Address"');
      expect(result).toContain('"Created At"');
    });

    it('should apply filters to export', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAuditLog], 1]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.exportAuditLogsToCsv({
        user_id: 'user-uuid-1',
        entity_type: 'user',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should escape CSV values with quotes', async () => {
      const logWithSpecialChars: AuditLog = {
        ...mockAuditLog,
        action: 'admin.test,with,commas',
        entity_type: 'test "quoted"',
      };
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[logWithSpecialChars], 1]);
      auditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.exportAuditLogsToCsv({});

      expect(result).toContain('"admin.test');
    });
  });
});
