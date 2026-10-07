/**
 * Configuration Debt Tracker - Safe Remediation Service
 * Prepares unified diff patches and applies verified configuration fixes
 * strictly requiring explicit user confirmation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DebtFinding, RemediationProposal } from '../models/finding';

export interface PatchApplyResult {
  success: boolean;
  filePath: string;
  message: string;
}

export class RemediationService {
  constructor(private workspaceRoot: string) {}

  /**
   * Prepares a proposed diff patch for a configuration debt finding
   */
  prepareProposal(finding: DebtFinding): RemediationProposal | null {
    if (finding.remediationProposal) {
      return finding.remediationProposal;
    }

    const item = finding.configurationItem;
    if (finding.category === 'dead_configuration' || finding.category === 'unused_feature_flag') {
      return {
        filePath: item.filePath,
        line: item.line,
        originalText: `${item.key}=${item.value}`,
        proposedDiff: `- ${item.key}=${item.value}`,
        explanation: `Remove obsolete configuration declaration '${item.key}'.`,
        actionType: 'delete_declaration'
      };
    }

    if (finding.category === 'hardcoded_secret') {
      return {
        filePath: item.filePath,
        line: item.line,
        originalText: `${item.key}=${item.value}`,
        proposedDiff: `- ${item.key}=${item.value}\n+ ${item.key}=\${${item.key}}`,
        explanation: `Replace plaintext secret with environment variable interpolation.`,
        actionType: 'mask_secret'
      };
    }

    if (finding.category === 'undocumented_configuration') {
      return {
        filePath: item.filePath,
        line: item.line,
        originalText: `${item.key}=${item.value}`,
        proposedDiff: `+ # ${item.key}: Configuration documentation\n  ${item.key}=${item.value}`,
        explanation: `Add comment header for undocumented configuration '${item.key}'.`,
        actionType: 'add_documentation'
      };
    }

    return null;
  }

  /**
   * Applies the proposed diff patch to the target file on disk
   */
  async applyProposal(proposal: RemediationProposal): Promise<PatchApplyResult> {
    const fullPath = path.isAbsolute(proposal.filePath)
      ? proposal.filePath
      : path.join(this.workspaceRoot, proposal.filePath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        filePath: proposal.filePath,
        message: `File does not exist: ${proposal.filePath}`
      };
    }

    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const targetIdx = Math.max(0, proposal.line - 1);

      if (proposal.actionType === 'delete_declaration') {
        // Comment out or remove line
        lines.splice(targetIdx, 1);
        await fs.promises.writeFile(fullPath, lines.join('\n'), 'utf-8');
        return {
          success: true,
          filePath: proposal.filePath,
          message: `Successfully removed line ${proposal.line} from ${proposal.filePath}.`
        };
      } else if (proposal.actionType === 'add_documentation') {
        // Add doc comment above line
        const comment = `# ${proposal.explanation}`;
        lines.splice(targetIdx, 0, comment);
        await fs.promises.writeFile(fullPath, lines.join('\n'), 'utf-8');
        return {
          success: true,
          filePath: proposal.filePath,
          message: `Added documentation header to ${proposal.filePath}:${proposal.line}.`
        };
      }

      return {
        success: false,
        filePath: proposal.filePath,
        message: 'Action type requires manual inspection.'
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filePath: proposal.filePath,
        message: `Failed to apply remediation: ${msg}`
      };
    }
  }
}
