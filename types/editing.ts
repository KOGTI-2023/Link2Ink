
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { D3Node, D3Link } from './types';

// The canonical source of truth for the architecture
export interface BlueprintSpec {
  nodes: D3Node[];
  links: D3Link[];
  groups?: { id: string; label: string; nodeIds: string[] }[];
  title: string;
}

export interface RenderParams2D {
  theme: 'dark' | 'light' | 'blueprint' | 'cyberpunk';
  showLabels: boolean;
  fontSize: number;
  nodeSizeScale: number;
  edgeWidthScale: number;
  primaryColor?: string;
}

export interface RenderParams3D {
  style: string;
  cameraAngle: 'isometric' | 'top-down' | 'perspective';
  lighting: 'studio' | 'neon' | 'natural';
  regenerateOnTextChange: boolean;
}

export interface AnalysisSession {
  id: string;
  repoName: string;
  currentVersionId: string;
  versions: Record<string, AnalysisVersion>;
  history: string[]; // Array of version IDs in order
}

export interface AnalysisVersion {
  id: string;
  timestamp: number;
  spec: BlueprintSpec;
  render2D: RenderParams2D;
  render3D: RenderParams3D;
  commitMessage: string;
  costUSD: number;
  // If 3D image is generated for this version, store it here
  imageData3D?: string; 
}

// JSON Patch Operation (RFC 6902 style)
export interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
}

// The structured output from the Editor Agent
export interface EditPlan {
  intentSummary: string;
  riskLevel: 'low' | 'medium' | 'high';
  affectedArtifacts: {
    flow2D: boolean;
    holo3D: boolean;
  };
  patches: Array<{
    target: 'spec' | 'render2D' | 'render3D';
    ops: PatchOperation[];
  }>;
  requiresRegeneration: boolean;
  regenerationPlan?: string;
  estimatedCostUSD: number;
}
