import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { AuditLog } from '../decorators/audit-log.decorator';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  status: 'unloaded' | 'loaded' | 'error';
  file_path: string;
  error?: string;
}

export interface UploadPluginParams {
  filename: string;
  content: string;
}

export interface UploadPluginResult {
  message: string;
  filename: string;
  file_path: string;
}

export interface ReloadPluginResult {
  message: string;
  plugin: string;
}

@Injectable()
export class PluginManagementService {
  private readonly logger = new Logger(PluginManagementService.name);
  private readonly pluginDir = process.env.PLUGIN_DIR || './plugins';

  constructor(private readonly eventPublisher: AuditEventPublisher) {}

  async listPlugins(): Promise<PluginInfo[]> {
    if (!fs.existsSync(this.pluginDir)) {
      return [];
    }

    const plugins: PluginInfo[] = [];
    const files = fs.readdirSync(this.pluginDir).filter((f) => f.endsWith('.js'));

    for (const file of files) {
      try {
        const filePath = path.join(this.pluginDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        const nameMatch = content.match(/name\s*=\s*['"]([^'"]+)['"]/);
        const versionMatch = content.match(/version\s*=\s*['"]([^'"]+)['"]/);
        const descMatch = content.match(/description\s*=\s*['"]([^'"]+)['"]/);

        plugins.push({
          id: uuidv4(),
          name: nameMatch?.[1] || file.replace('.js', ''),
          version: versionMatch?.[1] || '1.0.0',
          description: descMatch?.[1] || 'Custom rate provider plugin',
          status: 'unloaded',
          file_path: filePath,
        });
      } catch (error) {
        plugins.push({
          id: uuidv4(),
          name: file.replace('.js', ''),
          version: 'unknown',
          description: 'Error loading plugin',
          status: 'error',
          file_path: file,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return plugins;
  }

  @AuditLog({
    action: 'admin.plugin.upload',
    entityType: 'plugin',
    getEntityId: (_args, result) => result?.filename,
    getNewValue: (_args, result) => ({
      filename: result?.filename,
      file_path: result?.file_path,
    }),
  })
  async uploadPlugin(
    params: UploadPluginParams,
    _adminId: string,
    _ipAddress?: string,
  ): Promise<UploadPluginResult> {
    if (!params.filename.endsWith('.js')) {
      throw new BadRequestException('Plugin must be a JavaScript file (.js)');
    }

    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }

    const filePath = path.join(this.pluginDir, params.filename);
    fs.writeFileSync(filePath, params.content);

    return {
      message: 'Plugin uploaded successfully',
      filename: params.filename,
      file_path: filePath,
    };
  }

  @AuditLog({
    action: 'admin.plugin.reload',
    entityType: 'plugin',
    getEntityId: (args) => args[0],
    getOldValue: async (args, _result, instance) => {
      const plugins = await instance.listPlugins();
      const plugin = plugins.find((p: PluginInfo) => p.id === args[0]);
      return plugin ? { name: plugin.name, file_path: plugin.file_path } : undefined;
    },
    getNewValue: (_args, result) => ({
      plugin: result?.plugin,
    }),
  })
  async reloadPlugin(
    pluginId: string,
    _adminId: string,
    _ipAddress?: string,
  ): Promise<ReloadPluginResult> {
    const plugins = await this.listPlugins();
    const plugin = plugins.find((p) => p.id === pluginId);

    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    return {
      message: 'Plugin reloaded successfully',
      plugin: plugin.name,
    };
  }
}
