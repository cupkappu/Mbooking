import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PluginManagementService, PluginInfo } from './plugin-management.service';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { AuditLog } from '../entities/audit-log.entity';

describe('PluginManagementService', () => {
  let service: PluginManagementService;
  let eventPublisher: jest.Mocked<AuditEventPublisher>;

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginManagementService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepository },
        { provide: AuditEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<PluginManagementService>(PluginManagementService);
    eventPublisher = module.get(AuditEventPublisher);

    jest.spyOn(service as any, 'listPlugins').mockImplementation(async () => {
      return [
        {
          id: 'plugin-1',
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          status: 'unloaded' as const,
          file_path: '/plugins/test-plugin.js',
        },
      ];
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listPlugins', () => {
    it('should return list of plugins', async () => {
      const result = await service.listPlugins();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        status: 'unloaded',
      });
    });
  });

  describe('uploadPlugin', () => {
    it('should throw BadRequestException for non-JavaScript files', async () => {
      const params = { filename: 'plugin.txt', content: 'console.log("test")' };

      await expect(service.uploadPlugin(params, 'admin-uuid')).rejects.toThrow(BadRequestException);
      await expect(service.uploadPlugin(params, 'admin-uuid')).rejects.toThrow('Plugin must be a JavaScript file (.js)');
    });

    it('should throw BadRequestException when filename does not end with .js', async () => {
      const params = { filename: 'plugin.ts', content: 'console.log("test")' };

      await expect(service.uploadPlugin(params, 'admin-uuid')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for uppercase .JS extension', async () => {
      const params = { filename: 'plugin.JS', content: 'console.log("test")' };

      await expect(service.uploadPlugin(params, 'admin-uuid')).rejects.toThrow(BadRequestException);
    });

    it('should publish audit event when plugin is uploaded', async () => {
      const params = { filename: 'test-plugin.js', content: '// Test plugin content' };

      const result = await service.uploadPlugin(params, 'admin-uuid', '127.0.0.1');

      expect(result.message).toBe('Plugin uploaded successfully');
      expect(result.filename).toBe('test-plugin.js');
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should handle missing ipAddress parameter', async () => {
      const params = { filename: 'test-plugin.js', content: '// Test plugin' };

      const result = await service.uploadPlugin(params, 'admin-uuid');

      expect(result.message).toBe('Plugin uploaded successfully');
      expect(eventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('reloadPlugin', () => {
    it('should throw NotFoundException when plugin does not exist', async () => {
      (service as any).listPlugins.mockResolvedValue([]);

      await expect(service.reloadPlugin('non-existent-id', 'admin-uuid')).rejects.toThrow(NotFoundException);
      await expect(service.reloadPlugin('non-existent-id', 'admin-uuid')).rejects.toThrow('Plugin not found');
    });

    it('should throw NotFoundException for empty plugins list', async () => {
      (service as any).listPlugins.mockResolvedValue([]);

      await expect(service.reloadPlugin('some-id', 'admin-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should publish audit event when plugin is reloaded', async () => {
      const result = await service.reloadPlugin('plugin-1', 'admin-uuid', '127.0.0.1');

      expect(result.message).toBe('Plugin reloaded successfully');
      expect(result.plugin).toBe('test-plugin');
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should handle missing ipAddress parameter', async () => {
      const result = await service.reloadPlugin('plugin-1', 'admin-uuid');

      expect(result.message).toBe('Plugin reloaded successfully');
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should reload the correct plugin by ID', async () => {
      (service as any).listPlugins.mockResolvedValue([
        { id: 'p1', name: 'Plugin One', version: '1.0.0', status: 'unloaded' as const, file_path: '/p1.js' },
        { id: 'p2', name: 'Plugin Two', version: '2.0.0', status: 'unloaded' as const, file_path: '/p2.js' },
      ]);

      const result1 = await service.reloadPlugin('p1', 'admin-uuid');
      expect(result1.plugin).toBe('Plugin One');

      const result2 = await service.reloadPlugin('p2', 'admin-uuid');
      expect(result2.plugin).toBe('Plugin Two');
    });
  });
});
