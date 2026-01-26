/**
 * Multi-Currency Accounting - Docker Configuration Validation
 *
 * Simple validation that Docker files are syntactically valid.
 * Full Docker build and integration tests run in CI pipeline.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
const YAML = require('yaml');

// Use relative paths from backend directory (where tests run from)
const BACKEND_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_DIR, '..');
const FRONTEND_DIR = path.resolve(PROJECT_ROOT, 'frontend');
const DOCKER_COMPOSE_FILE = path.join(PROJECT_ROOT, 'docker-compose.yml');

// ============================================================================
// DOCKER FILE VALIDATION
// ============================================================================

describe('Docker Configuration', () => {
  describe('docker-compose.yml', () => {
    it('should exist', () => {
      expect(fs.existsSync(DOCKER_COMPOSE_FILE)).toBe(true);
    });

    it('should be valid YAML', () => {
      const content = fs.readFileSync(DOCKER_COMPOSE_FILE, 'utf-8');
      expect(() => YAML.parse(content)).not.toThrow();
    });
  });

  describe('Dockerfiles', () => {
    it('backend Dockerfile should exist', () => {
      expect(fs.existsSync(`${BACKEND_DIR}/Dockerfile`)).toBe(true);
    });

    it('frontend Dockerfile should exist', () => {
      expect(fs.existsSync(`${FRONTEND_DIR}/Dockerfile`)).toBe(true);
    });

    it('Dockerfiles should not be empty', () => {
      const backend = fs.readFileSync(`${BACKEND_DIR}/Dockerfile`, 'utf-8');
      const frontend = fs.readFileSync(`${FRONTEND_DIR}/Dockerfile`, 'utf-8');
      expect(backend.length).toBeGreaterThan(100);
      expect(frontend.length).toBeGreaterThan(100);
    });
  });
});
