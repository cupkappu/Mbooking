import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

describe('SetupController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Set INIT_SECRET for tests
    process.env.INIT_SECRET = 'test-secret-key-for-e2e-tests';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    delete process.env.INIT_SECRET;
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE tenants CASCADE');
    await dataSource.query('TRUNCATE TABLE currencies CASCADE');
  });

  describe('GET /api/v1/setup/status', () => {
    it('should return initialized: false when no users exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/setup/status')
        .expect(200);

      expect(response.body).toEqual({
        initialized: false,
        userCount: 0,
      });
    });

    it('should return initialized: true when users exist', async () => {
      // Create a user first
      await dataSource.query(`
        INSERT INTO users (id, email, name, password, role, provider, is_active, created_at, updated_at)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'Test User', 'hash', 'user', 'credentials', true, NOW(), NOW())
      `);

      const response = await request(app.getHttpServer())
        .get('/api/v1/setup/status')
        .expect(200);

      expect(response.body).toEqual({
        initialized: true,
        userCount: 1,
      });
    });
  });

  describe('POST /api/v1/setup/initialize', () => {
    it('should return 403 when INIT_SECRET is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/setup/initialize')
        .send({
          email: 'admin@example.com',
          password: 'SecureP@ss123!',
          name: 'Administrator',
        })
        .expect(403);

      expect(response.body.message).toBe('Invalid or missing initialization secret');
    });

    it('should return 409 when system already initialized', async () => {
      // Create a user first
      await dataSource.query(`
        INSERT INTO users (id, email, name, password, role, provider, is_active, created_at, updated_at)
        VALUES ('550e8400-e29b-41d4-a716-446655440002', 'test@example.com', 'Test User', 'hash', 'user', 'credentials', true, NOW(), NOW())
      `);

      const response = await request(app.getHttpServer())
        .post('/api/v1/setup/initialize')
        .set('X-Init-Secret', 'test-secret-key-for-e2e-tests')
        .send({
          email: 'admin@example.com',
          password: 'SecureP@ss123!',
          name: 'Administrator',
        })
        .expect(409);

      expect(response.body.message).toBe('System is already initialized');
    });

    it('should successfully initialize system with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/setup/initialize')
        .set('X-Init-Secret', 'test-secret-key-for-e2e-tests')
        .send({
          email: 'admin@example.com',
          password: 'SecureP@ss123!',
          name: 'Administrator',
          organizationName: 'Test Organization',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('System initialized successfully');
      expect(response.body.user.email).toBe('admin@example.com');
      expect(response.body.user.name).toBe('Administrator');
      expect(response.body.user.role).toBe('admin');

      // Verify user was created in database
      const users = await dataSource.query('SELECT * FROM users WHERE email = $1', ['admin@example.com']);
      expect(users.length).toBe(1);
      expect(users[0].role).toBe('admin');

      // Verify tenant was created
      const tenants = await dataSource.query('SELECT * FROM tenants WHERE user_id = $1', [users[0].id]);
      expect(tenants.length).toBe(1);
      expect(tenants[0].name).toBe('Test Organization');

      // Verify currencies were seeded
      const currencies = await dataSource.query('SELECT COUNT(*) as count FROM currencies');
      expect(parseInt(currencies[0].count, 10)).toBeGreaterThan(0);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/setup/initialize')
        .set('X-Init-Secret', 'test-secret-key-for-e2e-tests')
        .send({
          email: 'invalid-email',
          password: 'SecureP@ss123!',
          name: 'Administrator',
        })
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/setup/initialize')
        .set('X-Init-Secret', 'test-secret-key-for-e2e-tests')
        .send({
          email: 'admin@example.com',
          password: 'weak',
          name: 'Administrator',
        })
        .expect(400);

      expect(response.body.message).toContain('password');
    });
  });
});
