import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConflictException } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { InitializeSystemDto } from './dto/initialize.dto';

describe('SetupController (e2e)', () => {
  let app: INestApplication;
  let mockSetupService: any;

  beforeAll(async () => {
    mockSetupService = {
      getStatus: jest.fn(),
      initialize: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [SetupController],
      providers: [
        {
          provide: SetupService,
          useValue: mockSetupService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /setup/status', () => {
    it('should return status from service', async () => {
      mockSetupService.getStatus.mockResolvedValue({
        initialized: false,
        userCount: 0,
        currencyCount: 15,
      });

      const response = await request(app.getHttpServer())
        .get('/setup/status')
        .expect(200);

      expect(response.body).toEqual({
        initialized: false,
        userCount: 0,
        currencyCount: 15,
      });
    });

    it('should return initialized status when users exist', async () => {
      mockSetupService.getStatus.mockResolvedValue({
        initialized: true,
        userCount: 1,
        currencyCount: 15,
      });

      const response = await request(app.getHttpServer())
        .get('/setup/status')
        .expect(200);

      expect(response.body.initialized).toBe(true);
      expect(response.body.userCount).toBe(1);
    });
  });

  describe('POST /setup/initialize', () => {
    const validDto: InitializeSystemDto = {
      email: 'admin@example.com',
      password: 'SecureP@ss123!',
      name: 'Administrator',
      organizationName: 'Test Org',
    };

    beforeEach(() => {
      mockSetupService.initialize.mockResolvedValue({
        success: true,
        message: 'System initialized successfully',
        user: {
          id: 'test-uuid',
          email: 'admin@example.com',
          name: 'Administrator',
          role: 'admin',
        },
      });
    });

    it('should return 403 when INIT_SECRET is not set on server', async () => {
      const originalEnv = process.env.INIT_SECRET;
      delete process.env.INIT_SECRET;

      try {
        const response = await request(app.getHttpServer())
          .post('/setup/initialize')
          .set('X-Init-Secret', 'some-secret')
          .send(validDto)
          .expect(403);

        expect(response.body.message).toContain('not configured');
      } finally {
        if (originalEnv) {
          process.env.INIT_SECRET = originalEnv;
        }
      }
    });

    it('should return 403 when INIT_SECRET header is missing', async () => {
      process.env.INIT_SECRET = 'server-secret';

      const response = await request(app.getHttpServer())
        .post('/setup/initialize')
        .send(validDto)
        .expect(403);

      expect(response.body.message).toContain('Invalid or missing');
    });

    it('should return 403 when INIT_SECRET header is invalid', async () => {
      process.env.INIT_SECRET = 'server-secret';

      const response = await request(app.getHttpServer())
        .post('/setup/initialize')
        .set('X-Init-Secret', 'wrong-secret')
        .send(validDto)
        .expect(403);

      expect(response.body.message).toContain('Invalid or missing');
    });

    it('should return 201 when INIT_SECRET matches', async () => {
      process.env.INIT_SECRET = 'correct-secret';

      const response = await request(app.getHttpServer())
        .post('/setup/initialize')
        .set('X-Init-Secret', 'correct-secret')
        .send(validDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(validDto.email);
      expect(mockSetupService.initialize).toHaveBeenCalledWith(validDto);
    });

    it('should return 409 when system is already initialized', async () => {
      process.env.INIT_SECRET = 'correct-secret';
      mockSetupService.initialize.mockRejectedValue(
        new ConflictException('System is already initialized')
      );

      const response = await request(app.getHttpServer())
        .post('/setup/initialize')
        .set('X-Init-Secret', 'correct-secret')
        .send(validDto)
        .expect(409);

      expect(response.body.message).toBe('System is already initialized');
    });
  });
});
