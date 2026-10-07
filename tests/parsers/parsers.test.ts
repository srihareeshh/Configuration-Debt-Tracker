/**
 * Tests for Configuration Format Parsers:
 * .env, YAML, JSON, XML, Dockerfile, Docker Compose, Kubernetes
 */

import * as assert from 'assert';
import { DockerParser } from '../../src/parsers/docker/dockerParser';
import { EnvParser } from '../../src/parsers/env/envParser';
import { JsonParser } from '../../src/parsers/json/jsonParser';
import { KubernetesParser } from '../../src/parsers/kubernetes/kubernetesParser';
import { XmlParser } from '../../src/parsers/xml/xmlParser';
import { YamlParser } from '../../src/parsers/yaml/yamlParser';
import { ScannedFileInfo } from '../../src/utils/fileUtils';

export async function runParserTests(): Promise<void> {
  console.log('--- Running Configuration Parser Tests ---');

  // 1. Env Parser Test
  {
    const parser = new EnvParser();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/.env',
      relativePath: '.env',
      filename: '.env',
      extension: '',
      mtime: new Date(),
      ageDays: 10
    };
    const content = `
# Database credentials
DATABASE_URL=postgres://user:pass@localhost:5432/db
# App timeout
API_TIMEOUT=5000
OLD_API_URL=https://legacy.api.com
API_KEY=mock_live_stripe_98765432101234567890abcd
`;
    const items = await parser.parse(fileInfo, content);
    assert.strictEqual(items.length, 4, 'EnvParser should extract 4 configuration items');

    const dbItem = items.find((i) => i.key === 'DATABASE_URL');
    assert.ok(dbItem, 'DATABASE_URL must be found');
    assert.strictEqual(dbItem?.line, 3, 'DATABASE_URL line should be 3');
    assert.strictEqual(dbItem?.documentation, 'Database credentials');

    const secretItem = items.find((i) => i.key === 'API_KEY');
    assert.ok(secretItem?.isPotentialSecret, 'API_KEY must be flagged as potential secret');
    assert.ok(secretItem?.maskedValue.includes('••••'), 'Secret value must be masked');
    console.log('✓ EnvParser passed');
  }

  // 2. YAML Parser Test
  {
    const parser = new YamlParser();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/application.yml',
      relativePath: 'application.yml',
      filename: 'application.yml',
      extension: '.yml',
      mtime: new Date(),
      ageDays: 5
    };
    const content = `
server:
  port: 8080
# Database configuration
database:
  url: postgres://localhost:5432/mydb
  pool:
    max: 10
`;
    const items = await parser.parse(fileInfo, content);
    assert.ok(items.length >= 3, 'YamlParser should extract properties');

    const portItem = items.find((i) => i.key === 'server.port');
    assert.ok(portItem, 'server.port must be found');
    assert.strictEqual(portItem?.value, '8080');

    const dbItem = items.find((i) => i.key === 'database.url');
    assert.ok(dbItem, 'database.url must be found');
    console.log('✓ YamlParser passed');
  }

  // 3. JSON Parser Test
  {
    const parser = new JsonParser();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/appsettings.json',
      relativePath: 'appsettings.json',
      filename: 'appsettings.json',
      extension: '.json',
      mtime: new Date(),
      ageDays: 3
    };
    const content = JSON.stringify({
      Logging: {
        LogLevel: {
          Default: 'Information'
        }
      },
      ConnectionStrings: {
        DefaultConnection: 'Server=localhost;Database=Test;'
      }
    }, null, 2);

    const items = await parser.parse(fileInfo, content);
    assert.ok(items.length >= 2, 'JsonParser should extract nested keys');
    assert.ok(items.some((i) => i.key === 'Logging.LogLevel.Default'), 'Logging.LogLevel.Default must be found');
    assert.ok(items.some((i) => i.key === 'ConnectionStrings.DefaultConnection'), 'ConnectionStrings.DefaultConnection must be found');
    console.log('✓ JsonParser passed');
  }

  // 4. XML Parser Test
  {
    const parser = new XmlParser();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/pom.xml',
      relativePath: 'pom.xml',
      filename: 'pom.xml',
      extension: '.xml',
      mtime: new Date(),
      ageDays: 20
    };
    const content = `
<project>
  <properties>
    <database.url>jdbc:postgresql://localhost/prod</database.url>
    <jwt.secret>supersecrettoken1234567890</jwt.secret>
  </properties>
</project>
`;
    const items = await parser.parse(fileInfo, content);
    assert.ok(items.length >= 2, 'XmlParser should extract XML properties');
    assert.ok(items.some((i) => i.key.includes('database.url')), 'database.url should be found in XML');
    console.log('✓ XmlParser passed');
  }

  // 5. Docker Parser Test (Dockerfile + Compose)
  {
    const parser = new DockerParser();
    const dockerfileInfo: ScannedFileInfo = {
      absolutePath: '/mock/Dockerfile',
      relativePath: 'Dockerfile',
      filename: 'Dockerfile',
      extension: '',
      mtime: new Date(),
      ageDays: 15
    };
    const dockerContent = `
FROM node:20
ARG NODE_ENV=production
ENV PORT 3000
ENV API_TIMEOUT=5000
`;
    const dfItems = await parser.parse(dockerfileInfo, dockerContent);
    assert.strictEqual(dfItems.length, 3, 'Dockerfile should extract 1 ARG and 2 ENVs');
    assert.ok(dfItems.some((i) => i.key === 'PORT' && i.type === 'docker-env'));
    assert.ok(dfItems.some((i) => i.key === 'NODE_ENV' && i.type === 'docker-arg'));

    const composeInfo: ScannedFileInfo = {
      absolutePath: '/mock/docker-compose.yml',
      relativePath: 'docker-compose.yml',
      filename: 'docker-compose.yml',
      extension: '.yml',
      mtime: new Date(),
      ageDays: 12
    };
    const composeContent = `
version: '3.8'
services:
  web:
    environment:
      - DATABASE_URL=postgres://localhost/app
      - API_TIMEOUT=5000
`;
    const composeItems = await parser.parse(composeInfo, composeContent);
    assert.strictEqual(composeItems.length, 2, 'Docker Compose should extract 2 env items');
    assert.ok(composeItems.some((i) => i.key === 'DATABASE_URL'));
    assert.ok(composeItems.some((i) => i.key === 'API_TIMEOUT'));
    console.log('✓ DockerParser passed');
  }

  // 6. Kubernetes Parser Test
  {
    const parser = new KubernetesParser();
    const k8sInfo: ScannedFileInfo = {
      absolutePath: '/mock/k8s-configmap.yaml',
      relativePath: 'k8s-configmap.yaml',
      filename: 'k8s-configmap.yaml',
      extension: '.yaml',
      mtime: new Date(),
      ageDays: 30
    };
    const k8sContent = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_ENV: production
  LOG_LEVEL: debug
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  template:
    spec:
      containers:
        - name: web
          env:
            - name: CLUSTER_REGION
              value: "us-east-1"
`;
    const k8sItems = await parser.parse(k8sInfo, k8sContent);
    assert.strictEqual(k8sItems.length, 3, 'KubernetesParser should extract 2 ConfigMap items and 1 container env');
    assert.ok(k8sItems.some((i) => i.key === 'APP_ENV' && i.type === 'k8s-configmap'));
    assert.ok(k8sItems.some((i) => i.key === 'CLUSTER_REGION' && i.type === 'k8s-env'));
    console.log('✓ KubernetesParser passed');
  }

  // 7. TOML Parser Test
  {
    const { TomlParser } = await import('../../src/parsers/toml/tomlParser');
    const parser = new TomlParser();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/config.toml',
      relativePath: 'config.toml',
      filename: 'config.toml',
      extension: '.toml',
      mtime: new Date(),
      ageDays: 2
    };
    const content = `
# Global configuration
[database]
host = "db.internal"
port = 5432
`;
    const items = await parser.parse(fileInfo, content);
    assert.strictEqual(items.length, 2, 'TomlParser should extract 2 items');
    assert.ok(items.some((i) => i.key === 'database.host' && i.value === 'db.internal'));
    console.log('✓ TomlParser passed');
  }

  // 8. Properties Parser Test
  {
    const { PropertiesParser } = await import('../../src/parsers/properties/propertiesParser');
    const parser = new PropertiesParser();
    const fileInfo: ScannedFileInfo = {
      absolutePath: '/mock/application.properties',
      relativePath: 'application.properties',
      filename: 'application.properties',
      extension: '.properties',
      mtime: new Date(),
      ageDays: 1
    };
    const content = `
# Database setup
database.url=postgres://localhost:5432/app
server.port: 8080
`;
    const items = await parser.parse(fileInfo, content);
    assert.strictEqual(items.length, 2, 'PropertiesParser should extract 2 items');
    assert.ok(items.some((i) => i.key === 'database.url'));
    assert.ok(items.some((i) => i.key === 'server.port' && i.value === '8080'));
    console.log('✓ PropertiesParser passed');
  }
}

