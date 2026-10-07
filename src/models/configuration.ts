/**
 * Configuration Debt Tracker - Core Configuration Models
 * Maps directly to SCM Configuration Identification
 */

export type ConfigurationFormat =
  | 'env'
  | 'yaml'
  | 'json'
  | 'xml'
  | 'dockerfile'
  | 'kubernetes'
  | 'toml'
  | 'properties';

export type ConfigurationType =
  | 'env-var'
  | 'yaml-property'
  | 'json-property'
  | 'xml-tag'
  | 'docker-env'
  | 'docker-arg'
  | 'k8s-configmap'
  | 'k8s-secret'
  | 'k8s-env'
  | 'toml-property'
  | 'properties-entry';

export type SensitivityLevel =
  | 'public'
  | 'internal'
  | 'sensitive'
  | 'secret';

export interface ConfigurationItem {
  id: string;
  key: string;
  value: string;
  maskedValue: string;
  filePath: string;
  absoluteFilePath: string;
  line: number;
  format: ConfigurationFormat;
  type: ConfigurationType;
  sensitivity: SensitivityLevel;
  documentation?: string;
  lastModified?: Date;
  ageDays?: number;
  isPotentialSecret: boolean;
  secretType?: string;
}
