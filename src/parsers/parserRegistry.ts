/**
 * Configuration Debt Tracker - Parser Registry
 * Dispatches configuration files to format-specific adapters in priority order.
 */

import { ConfigurationItem } from '../models/configuration';
import { ScannedFileInfo } from '../utils/fileUtils';
import { IConfigurationParser } from './baseParser';
import { DockerParser } from './docker/dockerParser';
import { EnvParser } from './env/envParser';
import { JsonParser } from './json/jsonParser';
import { KubernetesParser } from './kubernetes/kubernetesParser';
import { XmlParser } from './xml/xmlParser';
import { YamlParser } from './yaml/yamlParser';

export class ParserRegistry {
  private parsers: IConfigurationParser[] = [];

  constructor() {
    // Register format-specific parsers in priority order
    this.parsers.push(new DockerParser());
    this.parsers.push(new KubernetesParser());
    this.parsers.push(new EnvParser());
    this.parsers.push(new YamlParser());
    this.parsers.push(new JsonParser());
    this.parsers.push(new XmlParser());
  }

  /**
   * Checks if any registered parser can handle this file
   */
  canParse(fileInfo: ScannedFileInfo): boolean {
    return this.parsers.some((p) => p.canParse(fileInfo));
  }

  /**
   * Parses a file using the first matching parser
   */
  async parse(fileInfo: ScannedFileInfo, content: string): Promise<ConfigurationItem[]> {
    for (const parser of this.parsers) {
      if (parser.canParse(fileInfo)) {
        return await parser.parse(fileInfo, content);
      }
    }
    return [];
  }

  /**
   * Registers a custom or extended parser
   */
  registerParser(parser: IConfigurationParser): void {
    this.parsers.unshift(parser);
  }
}
