
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { BlueprintSpec, EditPlan, RenderParams2D, RenderParams3D, PatchOperation } from '../types/editing';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Pricing Constants (approximate for estimation)
const PRICING = {
  INPUT_TOKEN: 0.075 / 1_000_000,
  OUTPUT_TOKEN: 0.30 / 1_000_000,
  IMAGE_GEN: 0.04
};

export async function estimateEditCost(
  instruction: string,
  currentContext: any
): Promise<number> {
  // Quick pre-flight estimation using character count as proxy for tokens if offline,
  // or a dry-run countTokens if we want precision. 
  // For UI responsiveness, we'll use a heuristic here.
  const contextSize = JSON.stringify(currentContext).length;
  const inputTokens = (contextSize + instruction.length) / 4;
  const outputTokens = 500; // Expected patch size
  
  return (inputTokens * PRICING.INPUT_TOKEN) + (outputTokens * PRICING.OUTPUT_TOKEN);
}

export async function generateEditPlan(
  instruction: string,
  spec: BlueprintSpec,
  render2D: RenderParams2D,
  render3D: RenderParams3D
): Promise<EditPlan> {
  
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are a specialized JSON Patch Generator for a software architecture visualization tool.
    Your goal is to translate user natural language instructions into strict JSON patches.
    
    Context:
    - 'spec': The graph structure (nodes, links, labels).
    - 'render2D': Visual settings for the SVG view (colors, fonts).
    - 'render3D': Prompt settings for the generative 3D view.
    
    Rules:
    1. If the user wants to rename a node, generate a 'replace' op for that node's label in 'spec'.
    2. If the user wants to change colors/fonts, target 'render2D'.
    3. If the user wants to change the 3D style, target 'render3D'.
    4. changing 'spec' or 'render2D' is low risk. changing 'render3D' usually requires regeneration (high cost).
    
    Output Format: Strict JSON matching the EditPlan schema.
  `;

  const prompt = `
    Current State:
    Spec: ${JSON.stringify(spec).slice(0, 5000)}... (truncated)
    Render2D: ${JSON.stringify(render2D)}
    Render3D: ${JSON.stringify(render3D)}
    
    User Instruction: "${instruction}"
    
    Generate the EditPlan.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["intentSummary", "riskLevel", "affectedArtifacts", "patches", "requiresRegeneration", "estimatedCostUSD"],
          properties: {
            intentSummary: { type: Type.STRING },
            riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
            affectedArtifacts: {
              type: Type.OBJECT,
              properties: {
                flow2D: { type: Type.BOOLEAN },
                holo3D: { type: Type.BOOLEAN }
              }
            },
            patches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING, enum: ["spec", "render2D", "render3D"] },
                  ops: {
                    type: Type.ARRAY,
                    items: {
                       type: Type.OBJECT,
                       properties: {
                         op: { type: Type.STRING },
                         path: { type: Type.STRING },
                         value: { type: Type.STRING } // Simplified for schema, actual value can be any
                       }
                    }
                  }
                }
              }
            },
            requiresRegeneration: { type: Type.BOOLEAN },
            regenerationPlan: { type: Type.STRING },
            estimatedCostUSD: { type: Type.NUMBER }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as EditPlan;
    }
    throw new Error("Empty response from Editor Agent");
  } catch (e) {
    console.error("Edit Plan Generation Failed", e);
    throw e;
  }
}

// Simple JSON Patch applicator (lightweight implementation to avoid massive deps)
export function applyPatches(original: any, patches: PatchOperation[]): any {
  const clone = JSON.parse(JSON.stringify(original));
  
  patches.forEach(p => {
    // Basic implementation for flat/nested structures commonly found in our spec
    // For production, use 'fast-json-patch' library
    const parts = p.path.split('/').filter(Boolean);
    let current = clone;
    
    // Navigate to parent
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    
    const key = parts[parts.length - 1];
    
    switch (p.op) {
      case 'replace':
      case 'add':
        // Handle array indices
        if (Array.isArray(current) && !isNaN(Number(key))) {
             current[Number(key)] = p.value;
        } else {
             current[key] = p.value;
        }
        break;
      case 'remove':
         if (Array.isArray(current)) {
             current.splice(Number(key), 1);
         } else {
             delete current[key];
         }
         break;
    }
  });
  
  return clone;
}
