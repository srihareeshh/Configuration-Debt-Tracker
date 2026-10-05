/**
 * Configuration Debt Tracker - Kubernetes Manifest Parser
 * Extracts ConfigMap data, Secret keys, and Pod/Deployment environment variables.
 */

import * as YAML from 'yaml';
import { ConfigurationItem } from '../../models/configuration';
import { ScannedFileInfo } from '../../utils/fileUtils';
import { detectSecret, maskValue } from '../../utils/secretDetector';
import { IConfigurationParser } from '../baseParser';

export class KubernetesParser implements IConfigurationParser {
  readonly id = 'kubernetes';
  readonly name = 'Kubernetes YAML Manifest Parser';

  canParse(fileInfo: ScannedFileInfo): boolean {
    const ext = fileInfo.extension;
    if (ext !== '.yaml' && ext !== '.yml') {
      return false;
    }
    const name = fileInfo.filename.toLowerCase();
    return (
      name.includes('k8s') ||
      name.includes('kube') ||
      name.includes('configmap') ||
      name.includes('deployment') ||
      name.includes('manifest') ||
      name.includes('ingress') ||
      name.includes('service')
    );
  }

  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    const items: ConfigurationItem[] = [];

    try {
      const lineCounter = new YAML.LineCounter();
      const docs = YAML.parseAllDocuments(content, { lineCounter });

      for (const doc of docs) {
        if (!doc || !doc.contents || !(doc.contents instanceof YAML.YAMLMap)) {
          continue;
        }

        const kind = String(doc.get('kind') ?? '');
        const meta = doc.get('metadata') as YAML.YAMLMap | undefined;
        const resourceName = meta && YAML.isMap(meta) ? String(meta.get('name') ?? '') : '';

        // 1. ConfigMap and Secret
        if (kind === 'ConfigMap' || kind === 'Secret') {
          const dataMap = doc.get('data') || doc.get('stringData');
          if (dataMap instanceof YAML.YAMLMap) {
            for (const pair of dataMap.items) {
              if (YAML.isPair(pair) && pair.key) {
                const keyStr = String(pair.key);
                const valStr = String(pair.value ?? '');
                const keyNode = pair.key as YAML.Scalar;
                const line = keyNode && keyNode.range ? lineCounter.linePos(keyNode.range[0]).line : 1;
                const isK8sSecret = kind === 'Secret';
                const secretCheck = isK8sSecret
                  ? { isSecret: true, sensitivity: 'secret' as const, secretType: 'Kubernetes Secret', confidence: 95 }
                  : detectSecret(keyStr, valStr);
                const masked = maskValue(valStr, secretCheck.isSecret);

                items.push({
                  id: `${fileInfo.relativePath}:${line}:${keyStr}`,
                  key: keyStr,
                  value: secretCheck.isSecret ? masked : valStr,
                  maskedValue: masked,
                  filePath: fileInfo.relativePath,
                  absoluteFilePath: fileInfo.absolutePath,
                  line,
                  format: 'kubernetes',
                  type: isK8sSecret ? 'k8s-secret' : 'k8s-configmap',
                  sensitivity: secretCheck.sensitivity,
                  documentation: `Kubernetes ${kind}: ${resourceName}`,
                  lastModified: fileInfo.mtime,
                  ageDays: fileInfo.ageDays,
                  isPotentialSecret: secretCheck.isSecret,
                  secretType: secretCheck.secretType
                });
              }
            }
          }
        }

        // 2. Deployment / Pod / StatefulSet / DaemonSet / Job
        if (['Deployment', 'Pod', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'].includes(kind)) {
          this.extractContainerEnvs(doc, fileInfo, lineCounter, items, `${kind}: ${resourceName}`);
        }
      }
    } catch {
      // Gracefully handle malformed Kubernetes manifests
    }

    return items;
  }

  private extractContainerEnvs(
    doc: YAML.Document,
    fileInfo: ScannedFileInfo,
    lineCounter: YAML.LineCounter,
    items: ConfigurationItem[],
    contextStr: string
  ): void {
    // Find container env lists within spec
    const spec = doc.get('spec');
    if (!spec || !(spec instanceof YAML.YAMLMap)) {
      return;
    }

    const template = spec.get('template');
    const podSpec = template instanceof YAML.YAMLMap ? template.get('spec') : spec;
    if (!podSpec || !(podSpec instanceof YAML.YAMLMap)) {
      return;
    }

    const containers = podSpec.get('containers');
    if (containers instanceof YAML.YAMLSeq) {
      for (const container of containers.items) {
        if (container instanceof YAML.YAMLMap) {
          const envSeq = container.get('env');
          if (envSeq instanceof YAML.YAMLSeq) {
            for (const envItem of envSeq.items) {
              if (envItem instanceof YAML.YAMLMap) {
                const nameNode = envItem.get('name', true) as YAML.Scalar | null;
                const valueNode = envItem.get('value', true) as YAML.Scalar | null;
                if (nameNode && nameNode.value) {
                  const keyStr = String(nameNode.value);
                  const valStr = valueNode ? String(valueNode.value ?? '') : '';
                  const line = nameNode.range ? lineCounter.linePos(nameNode.range[0]).line : 1;
                  const secretCheck = detectSecret(keyStr, valStr);
                  const masked = maskValue(valStr, secretCheck.isSecret);

                  items.push({
                    id: `${fileInfo.relativePath}:${line}:${keyStr}`,
                    key: keyStr,
                    value: secretCheck.isSecret ? masked : valStr,
                    maskedValue: masked,
                    filePath: fileInfo.relativePath,
                    absoluteFilePath: fileInfo.absolutePath,
                    line,
                    format: 'kubernetes',
                    type: 'k8s-env',
                    sensitivity: secretCheck.sensitivity,
                    documentation: `${contextStr}`,
                    lastModified: fileInfo.mtime,
                    ageDays: fileInfo.ageDays,
                    isPotentialSecret: secretCheck.isSecret,
                    secretType: secretCheck.secretType
                  });
                }
              }
            }
          }
        }
      }
    }
  }
}
