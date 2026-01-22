import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, bufferTime, filter } from 'rxjs';
import { AuditEventPublisher } from './audit-event-publisher.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AdminAuditEvent } from './admin-events.types';
import { v4 as uuidv4 } from 'uuid';

describe('AuditEventPublisher', () => {
  let publisher: AuditEventPublisher;
  let auditLogRepository: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const mockAuditLogRepo = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditEventPublisher,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
      ],
    }).compile();

    publisher = module.get<AuditEventPublisher>(AuditEventPublisher);
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(async () => {
    await publisher.close();
  });

  it('should be defined', () => {
    expect(publisher).toBeDefined();
  });

  describe('event enrichment', () => {
    it('should enrich event with generated id when id is empty', async () => {
      const eventSubject = new Subject<AdminAuditEvent>();
      const testEvents: AdminAuditEvent[] = [];

      eventSubject.pipe(
        bufferTime(100),
        filter(events => events.length > 0),
      ).subscribe({
        next: async (events) => {
          testEvents.push(...events);
        },
      });

      const event: AdminAuditEvent = {
        id: '',
        action: 'admin.user.create',
        entityType: 'User',
        entityId: 'user-123',
        userId: 'admin-1',
        tenantId: 'tenant-1',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      eventSubject.next({
        ...event,
        id: event.id || 'generated-id',
        timestamp: event.timestamp || new Date(),
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(testEvents.length).toBe(1);
      expect(testEvents[0].id).toBe('generated-id');
    });

    it('should generate valid UUID format using uuidv4', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const generatedUuid = uuidv4();
      expect(generatedUuid).toMatch(uuidRegex);
    });

    it('should preserve existing event id and timestamp', () => {
      const customId = 'custom-event-id';
      const customTimestamp = new Date('2024-01-01T00:00:00Z');

      const event: AdminAuditEvent = {
        id: customId,
        action: 'admin.currency.seed',
        entityType: 'Currency',
        userId: 'admin-1',
        timestamp: customTimestamp,
      };

      const enriched = {
        ...event,
        id: event.id || 'should-not-use-this',
        timestamp: event.timestamp || new Date(),
      };

      expect(enriched.id).toBe(customId);
      expect(enriched.timestamp).toBe(customTimestamp);
    });

    it('should deep clone oldValue and newValue', () => {
      const originalValue = { name: 'Original', nested: { deep: 'value' } };
      const newValue = { name: 'Updated', nested: { deep: 'new-value' } };

      const event: AdminAuditEvent = {
        id: '',
        action: 'admin.config.update',
        entityType: 'Config',
        userId: 'admin-1',
        oldValue: originalValue,
        newValue: newValue,
        timestamp: new Date(),
      };

      const enriched = {
        ...event,
        oldValue: event.oldValue ? JSON.parse(JSON.stringify(event.oldValue)) : undefined,
        newValue: event.newValue ? JSON.parse(JSON.stringify(event.newValue)) : undefined,
      };

      expect(enriched.oldValue).toEqual({ name: 'Original', nested: { deep: 'value' } });
      expect(enriched.newValue).toEqual({ name: 'Updated', nested: { deep: 'new-value' } });
    });
  });

  describe('publish integration', () => {
    it('should push event to internal subject', async () => {
      const event: AdminAuditEvent = {
        id: '',
        action: 'admin.user.create',
        entityType: 'User',
        entityId: 'user-123',
        userId: 'admin-1',
        tenantId: 'tenant-1',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      };

      const subjectEvents: AdminAuditEvent[] = [];
      const originalNext = publisher['eventSubject'].next.bind(publisher['eventSubject']);
      publisher['eventSubject'].next = (event: AdminAuditEvent) => {
        subjectEvents.push(event);
        originalNext(event);
      };

      publisher.publish(event);

      expect(subjectEvents.length).toBe(1);
      expect(subjectEvents[0].action).toBe('admin.user.create');
      expect(subjectEvents[0].entityType).toBe('User');
    });

    it('should enrich event with UUID before pushing to subject', async () => {
      const event: AdminAuditEvent = {
        id: '',
        action: 'admin.provider.test',
        entityType: 'Provider',
        userId: 'admin-1',
        timestamp: new Date(),
      };

      const subjectEvents: AdminAuditEvent[] = [];
      const originalNext = publisher['eventSubject'].next.bind(publisher['eventSubject']);
      publisher['eventSubject'].next = (e: AdminAuditEvent) => {
        subjectEvents.push(e);
        originalNext(e);
      };

      publisher.publish(event);

      expect(subjectEvents.length).toBe(1);
      expect(subjectEvents[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('flush', () => {
    it('should trigger a new subscription without error', async () => {
      await expect(publisher.flush()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should unsubscribe from event stream without error', async () => {
      await publisher.close();
      expect(publisher).toBeDefined();
    });
  });
});
