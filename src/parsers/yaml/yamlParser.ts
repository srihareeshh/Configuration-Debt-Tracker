/**
 * Configuration Debt Tracker - YAML/YML Configuration Parser
 * Extracts hierarchical and flat properties with exact AST line tracking and comment extraction.
 */

import * as YAML from 'yaml';
import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class YamlParser implements IConfigurationParser {
  readonly id = 'yaml';
  readonly name = 'YAML Configuration Parser (.yaml, .yml)';

  canParse(fileInfo: ScannedFileInfo): boolean {
    const filename = fileInfo.filename.toLowerCase();
    const ext = fileInfo.extension;
    // Let docker-compose and k8s parsers handle their specialized schemas
    if (filename.includes('docker-compose') || filename.includes('compose.')) {
      return false;
    }
    return ext === '.yaml' || ext === '.yml';
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const items: ConfigurationItem[] = [];

    try {
      const lineCounter = new YAML.LineCounter();
      const doc = YAML.parseDocument(content, { lineCounter, keepSourceTokens: true });

      if (!doc || !doc.contents) {
        return items;
      }

      // Check if this YAML is a Kubernetes manifest
      if (doc.contents instanceof YAML.YAMLMap) {
        const apiVersion = doc.get('apiVersion');
        const kind = doc.get('kind');
        if (apiVersion && kind) {
          // Kubernetes manifest; let the Kubernetes parser handle it
          return items;
        }
      }

      const traverse = (node: unknown, prefix: string) => {
        if (node instanceof YAML.YAMLMap) {
          for (const item of node.items) {
            if (YAML.isPair(item) && item.key) {
              const keyNode = item.key as YAML.Scalar;
              const valNode = item.value;
              const rawKeyStr = String(keyNode.value);
              const fullKey = prefix ? `${prefix}.${rawKeyStr}` : rawKeyStr;

              let line = 1;
              if (keyNode.range && keyNode.range[0] !== undefined) {
                line = lineCounter.linePos(keyNode.range[0]).line;
              }

              // Extract comments
              const comment = (keyNode.commentBefore || keyNode.comment || '')
                .replace(/^#+\s*/gm, '')
                .trim();

              if (valNode instanceof YAML.YAMLMap) {
                traverse(valNode, fullKey);
              } else if (valNode instanceof YAML.YAMLSeq) {
                // Scalar sequence or map sequence
                for (let idx = 0; idx < valNode.items.length; idx++) {
                  const seqItem = valNode.items[idx];
                  if (seqItem instanceof YAML.YAMLMap) {
                    traverse(seqItem, `${fullKey}[${idx}]`);
                  } else if (YAML.isScalar(seqItem)) {
                    const itemValStr = String(seqItem.value ?? '');
                    this.pushItem(items, fileInfo, `${fullKey}[${idx}]`, itemValStr, line, comment);
                  }
                }
              } else if (YAML.isScalar(valNode)) {
                const valStr = String(valNode.value ?? '');
                this.pushItem(items, fileInfo, fullKey, valStr, line, comment);
              } else if (valNode === null || valNode === undefined) {
                this.pushItem(items, fileInfo, fullKey, '', line, comment);
              }
            }
          }
        }
      };

      traverse(doc.contents, '');
    } catch {
      // Gracefully handle malformed YAML
    }

    return items;
  }

  private pushItem(
    items: ConfigurationItem[],
    fileInfo: ScannedFileInfo,
    key: string,
    value: string,
    line: number,
    documentation?: string
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
      format: 'yaml',
      type: 'yaml-property',
      sensitivity: secretCheck.sensitivity,
      documentation: documentation && documentation.length > 0 ? documentation : undefined,
      lastModified: fileInfo.mtime,
      ageDays: fileInfo.ageDays,
      isPotentialSecret: secretCheck.isSecret,
      secretType: secretCheck.secretType
    });
  }
}
