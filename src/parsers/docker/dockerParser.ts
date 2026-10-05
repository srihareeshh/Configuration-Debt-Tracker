/**
 * Configuration Debt Tracker - Dockerfile & Docker Compose Parser
 * Extracts environment variables, build arguments, and compose environment configurations.
 */

import * as YAML from 'yaml';
import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class DockerParser implements IConfigurationParser {
  readonly id = 'docker';
  readonly name = 'Docker & Compose Configuration Parser';

  canParse(fileInfo: ScannedFileInfo): boolean {
    const filename = fileInfo.filename.toLowerCase();
    return (
      filename === 'dockerfile' ||
      filename.startsWith('dockerfile.') ||
      filename.endsWith('.dockerfile') ||
      filename.includes('docker-compose') ||
      filename.startsWith('compose.')
    );
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const filename = fileInfo.filename.toLowerCase();
    if (filename.includes('compose')) {
      return this.parseCompose(fileInfo, content);
    } else {
      return this.parseDockerfile(fileInfo, content);
    }
  }

  private parseDockerfile(fileInfo: ScannedFileInfo, content: string): ConfigurationItem[] {
    const items: ConfigurationItem[] = [];
    const lines = content.split(/\r?\n/);
    let pendingDocLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (trimmed.startsWith('#')) {
        pendingDocLines.push(trimmed.replace(/^#+\s*/, '').trim());
        continue;
      }

      // Match ENV KEY=VALUE or ENV KEY VALUE
      const envMatch = trimmed.match(/^ENV\s+([a-zA-Z_][a-zA-Z0-9_.-]*)(?:=|\s+)(.*)$/i);
      if (envMatch) {
        const key = envMatch[1].trim();
        const value = envMatch[2].trim().replace(/^["']|["']$/g, '');
        const secretCheck = detectSecret(key, value);
        const masked = maskValue(value, secretCheck.isSecret);

        items.push({
          id: `${fileInfo.relativePath}:${lineNum}:${key}`,
          key,
          value: secretCheck.isSecret ? masked : value,
          maskedValue: masked,
          filePath: fileInfo.relativePath,
          absoluteFilePath: fileInfo.absolutePath,
          line: lineNum,
          format: 'dockerfile',
          type: 'docker-env',
          sensitivity: secretCheck.sensitivity,
          documentation: pendingDocLines.length > 0 ? pendingDocLines.join(' | ') : undefined,
          lastModified: fileInfo.mtime,
          ageDays: fileInfo.ageDays,
          isPotentialSecret: secretCheck.isSecret,
          secretType: secretCheck.secretType
        });
        pendingDocLines = [];
        continue;
      }

      // Match ARG KEY=VALUE or ARG KEY
      const argMatch = trimmed.match(/^ARG\s+([a-zA-Z_][a-zA-Z0-9_.-]*)(?:=(.*))?$/i);
      if (argMatch) {
        const key = argMatch[1].trim();
        const value = (argMatch[2] || '').trim().replace(/^["']|["']$/g, '');
        const secretCheck = detectSecret(key, value);
        const masked = maskValue(value, secretCheck.isSecret);

        items.push({
          id: `${fileInfo.relativePath}:${lineNum}:${key}`,
          key,
          value: secretCheck.isSecret ? masked : value,
          maskedValue: masked,
          filePath: fileInfo.relativePath,
          absoluteFilePath: fileInfo.absolutePath,
          line: lineNum,
          format: 'dockerfile',
          type: 'docker-arg',
          sensitivity: secretCheck.sensitivity,
          documentation: pendingDocLines.length > 0 ? pendingDocLines.join(' | ') : undefined,
          lastModified: fileInfo.mtime,
          ageDays: fileInfo.ageDays,
          isPotentialSecret: secretCheck.isSecret,
          secretType: secretCheck.secretType
        });
        pendingDocLines = [];
        continue;
      }

      if (trimmed !== '') {
        pendingDocLines = [];
      }
    }

    return items;
  }

  private parseCompose(fileInfo: ScannedFileInfo, content: string): ConfigurationItem[] {
    const items: ConfigurationItem[] = [];
    try {
      const lineCounter = new YAML.LineCounter();
      const doc = YAML.parseDocument(content, { lineCounter });
      if (!doc || !doc.contents || !(doc.contents instanceof YAML.YAMLMap)) {
        return items;
      }

      const services = doc.get('services');
      if (services instanceof YAML.YAMLMap) {
        for (const servicePair of services.items) {
          if (YAML.isPair(servicePair) && servicePair.value instanceof YAML.YAMLMap) {
            const serviceName = String(servicePair.key);
            const serviceMap = servicePair.value;
            const envNode = serviceMap.get('environment', true);

            if (envNode instanceof YAML.YAMLMap) {
              for (const envPair of envNode.items) {
                if (YAML.isPair(envPair) && envPair.key) {
                  const keyStr = String(envPair.key);
                  const valStr = String(envPair.value ?? '');
                  const keyNode = envPair.key as YAML.Scalar;
                  const line = keyNode && keyNode.range ? lineCounter.linePos(keyNode.range[0]).line : 1;
                  this.pushComposeItem(items, fileInfo, keyStr, valStr, line, serviceName);
                }
              }
            } else if (envNode instanceof YAML.YAMLSeq) {
              for (const seqItem of envNode.items) {
                if (YAML.isScalar(seqItem)) {
                  const entryStr = String(seqItem.value ?? '');
                  const eqIdx = entryStr.indexOf('=');
                  const key = eqIdx > 0 ? entryStr.slice(0, eqIdx).trim() : entryStr.trim();
                  const val = eqIdx > 0 ? entryStr.slice(eqIdx + 1).trim() : '';
                  const line = seqItem.range ? lineCounter.linePos(seqItem.range[0]).line : 1;
                  this.pushComposeItem(items, fileInfo, key, val, line, serviceName);
                }
              }
            }
          }
        }
      }
    } catch {
      // Gracefully handle malformed compose YAML
    }
    return items;
  }

  private pushComposeItem(
    items: ConfigurationItem[],
    fileInfo: ScannedFileInfo,
    key: string,
    value: string,
    line: number,
    serviceName: string
  ): void {
    const secretCheck = detectSecret(key, value);
    const masked = maskValue(value, secretCheck.isSecret);

    items.push({
      id: `${fileInfo.relativePath}:${line}:${key}`,
      key,
      value: secretCheck.isSecret ? masked : value,
      maskedValue: masked,
      filePath: fileInfo.relativePath,
      absoluteFilePath: fileInfo.absolutePath,
      line,
      format: 'dockerfile',
      type: 'docker-env',
      sensitivity: secretCheck.sensitivity,
      documentation: `Docker Compose Service: ${serviceName}`,
      lastModified: fileInfo.mtime,
      ageDays: fileInfo.ageDays,
      isPotentialSecret: secretCheck.isSecret,
      secretType: secretCheck.secretType
    });
  }
}
