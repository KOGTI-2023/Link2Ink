
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { RepoFileTree, Citation } from '../types';
import { BlueprintSpec } from '../types/editing';

// Helper to ensure we always get the freshest key from the environment
// immediately before a call.
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface InfographicResult {
    imageData: string | null;
    citations: Citation[];
}

export async function generateBlueprintSpec(
  repoName: string,
  fileTree: RepoFileTree[]
): Promise<BlueprintSpec> {
  const ai = getAiClient();
  const limitedTree = fileTree.slice(0, 200).map(f => f.path).join('\n');
  
  const prompt = `
    Analyze this repository structure and generate a logical data flow graph.
    Repo: ${repoName}
    Files:
    ${limitedTree}
    
    Output strictly valid JSON matching this schema:
    {
       "nodes": [{ "id": "unique_id", "label": "Readable Name", "group": 1 }],
       "links": [{ "source": "id_a", "target": "id_b", "value": 1 }],
       "title": "Diagram Title"
    }
    Group nodes by logical module (Auth, DB, UI, API). Limit to 15-20 most important nodes.
  `;

  try {
     const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
           responseMimeType: "application/json",
           responseSchema: {
              type: Type.OBJECT,
              required: ["nodes", "links", "title"],
              properties: {
                 title: { type: Type.STRING },
                 nodes: {
                    type: Type.ARRAY,
                    items: {
                       type: Type.OBJECT,
                       required: ["id", "label", "group"],
                       properties: {
                          id: { type: Type.STRING },
                          label: { type: Type.STRING },
                          group: { type: Type.INTEGER }
                       }
                    }
                 },
                 links: {
                    type: Type.ARRAY,
                    items: {
                       type: Type.OBJECT,
                       required: ["source", "target", "value"],
                       properties: {
                          source: { type: Type.STRING },
                          target: { type: Type.STRING },
                          value: { type: Type.INTEGER }
                       }
                    }
                 }
              }
           }
        }
     });
     
     if (response.text) {
         return JSON.parse(response.text) as BlueprintSpec;
     }
     throw new Error("Failed to generate blueprint JSON");
  } catch (e) {
     console.error("Blueprint Generation Failed", e);
     // Fallback to a minimal graph if AI fails
     return {
        title: repoName,
        nodes: [{ id: 'root', label: repoName, group: 1 }],
        links: []
     };
  }
}

export async function generateInfographic(
  repoName: string, 
  fileTree: RepoFileTree[], 
  style: string, 
  is3D: boolean = false,
  language: string = "English",
  cameraAngle: string = "Isometric"
): Promise<string | null> {
  const ai = getAiClient();
  // Summarize architecture for the image prompt
  const limitedTree = fileTree.slice(0, 150).map(f => f.path).join(', ');
  
  let styleGuidelines = "";
  let dimensionPrompt = "";

  if (is3D) {
      // OVERRIDE standard styles for a specific "Tabletop Model" look
      styleGuidelines = `VISUAL STYLE: Photorealistic Miniature Diorama. The data flow should look like a complex, glowing 3D printed physical model sitting on a dark, reflective executive desk. Style: ${style}.`;
      dimensionPrompt = `PERSPECTIVE & RENDER: ${cameraAngle} view with TILT-SHIFT depth of field (blurry foreground/background) to make it look like a small, tangible object on a table. Cinematic volumetric lighting. Highly detailed, 'octane render' style.`;
  } else {
      // Standard 2D styles or Custom
      switch (style) {
          case "Hand-Drawn Blueprint":
              styleGuidelines = `VISUAL STYLE: Technical architectural blueprint. Dark blue background with white/light blue hand-drawn lines. Looks like a sketch on drafting paper.`;
              break;
          case "Corporate Minimal":
              styleGuidelines = `VISUAL STYLE: Clean, corporate, minimalist. White background, lots of whitespace. Use a limited, professional color palette (greys, navy blues).`;
              break;
          case "Neon Cyberpunk":
              styleGuidelines = `VISUAL STYLE: Dark mode cyberpunk. Black background with glowing neon pink, cyan, and violet lines and nodes. High contrast, futuristic look.`;
              break;
          case "Modern Data Flow":
              styleGuidelines = `VISUAL STYLE: Replicate "Androidify Data Flow" aesthetic. Light blue (#eef8fe) solid background. Colorful, flat vector icons. Smooth, bright blue curved arrows.`;
              break;
          default:
              // Handle custom style string
              if (style && style !== "Custom") {
                  styleGuidelines = `VISUAL STYLE: ${style}.`;
              } else {
                  styleGuidelines = `VISUAL STYLE: Replicate "Androidify Data Flow" aesthetic. Light blue (#eef8fe) solid background. Colorful, flat vector icons. Smooth, bright blue curved arrows.`;
              }
              break;
      }
      dimensionPrompt = "Perspective: Clean 2D flat diagrammatic view straight-on. No 3D effects.";
  }

  const baseStylePrompt = `
  STRICT VISUAL STYLE GUIDELINES:
  ${styleGuidelines}
  - LAYOUT: Distinct Left-to-Right flow.
  - CENTRAL CONTAINER: Group core logic inside a clearly defined central area.
  - ICONS: Use relevant technical icons (databases, servers, code files, users).
  - TYPOGRAPHY: Highly readable technical font. Text MUST be in ${language}.
  `;

  const prompt = `Create a highly detailed technical logical data flow diagram infographic for GitHub repository : "${repoName}".
  
  ${baseStylePrompt}
  ${dimensionPrompt}
  
  Repository Context: ${limitedTree}...
  
  Diagram Content Requirements:
  1. Title exactly: "${repoName} Data Flow" (Translated to ${language} if not English)
  2. Visually map the likely data flow based on the provided file structure.
  3. Ensure the "Input -> Processing -> Output" structure is clear.
  4. Add short, clear text labels to connecting arrows indicating data type (e.g., "JSON", "Auth Token").
  5. IMPORTANT: All text labels and explanations in the image must be written in ${language}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini infographic generation failed:", error);
    throw error;
  }
}

export async function askRepoQuestion(question: string, infographicBase64: string, fileTree: RepoFileTree[]): Promise<string> {
  const ai = getAiClient();
  // Provide context about the file structure to supplement the image
  const limitedTree = fileTree.slice(0, 300).map(f => f.path).join('\n');
  
  const prompt = `You are a senior software architect reviewing a project.
  
  Attached is an architectural infographic of the project.
  Here is the actual file structure of the repository:
  ${limitedTree}
  
  User Question: "${question}"
  
  Using BOTH the visual infographic and the file structure as context, answer the user's question. 
  If they ask about optimization, suggest specific areas based on the likely bottlenecks visible in standard architectures like this.
  Keep answers concise, technical, and helpful.`;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-3-pro-preview',
       contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: infographicBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text || "I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini Q&A failed:", error);
    throw error;
  }
}

export async function askNodeSpecificQuestion(
  nodeLabel: string, 
  question: string, 
  fileTree: RepoFileTree[]
): Promise<string> {
  const ai = getAiClient();
  const limitedTree = fileTree.slice(0, 300).map(f => f.path).join('\n');
  
  const prompt = `You are a senior software architect analyzing a repository.
  
  The user is asking about a specific node in the dependency graph labeled: "${nodeLabel}".
  
  Repository File Structure Context (first 300 files):
  ${limitedTree}
  
  User Question: "${question}"
  
  Based on the node name "${nodeLabel}" and the file structure, explain what this component likely does, its responsibilities, and answer the specific question.
  Keep the response technical, concise, and helpful for a developer.`;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-3-pro-preview',
       contents: {
        parts: [
          { text: prompt }
        ]
      }
    });

    return response.text || "I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini Node Q&A failed:", error);
    throw error;
  }
}

export async function generateArticleInfographic(
  url: string, 
  style: string, 
  onProgress?: (stage: string) => void,
  language: string = "English"
): Promise<InfographicResult> {
    const ai = getAiClient();
    // PHASE 1: Content Understanding & Structural Breakdown (The "Planner")
    // Optimization: Using Gemini-3-Flash for much faster analysis
    if (onProgress) onProgress("RESEARCHING & ANALYZING CONTENT...");
    
    let structuralSummary = "";
    let citations: Citation[] = [];

    try {
        const analysisPrompt = `You are an expert Information Designer. Your goal is to extract the essential structure from a web page to create a clear, educational infographic.

        Analyze the content at this URL: ${url}
        
        TARGET LANGUAGE: ${language}.
        
        Provide a structured breakdown specifically designed for visual representation in ${language}:
        1. INFOGRAPHIC HEADLINE: The core topic in 5 words or less (in ${language}).
        2. KEY TAKEAWAYS: The 3 to 5 most important distinct points, steps, or facts (in ${language}). THESE WILL BE THE MAIN SECTIONS OF THE IMAGE.
        3. SUPPORTING DATA: Any specific numbers, percentages, or very short quotes that add credibility.
        4. VISUAL METAPHOR IDEA: Suggest ONE simple visual concept that best fits this content (e.g., "a roadmap with milestones", "a funnel", "three contrasting pillars", "a circular flowchart").
        
        Keep the output concise and focused purely on what should be ON the infographic. Ensure all content is in ${language}.`;

        const analysisResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: analysisPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        structuralSummary = analysisResponse.text || "";

        // Extract citations from grounding metadata with Titles
        const chunks = analysisResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    citations.push({
                        uri: chunk.web.uri,
                        title: chunk.web.title || ""
                    });
                }
            });
            const uniqueCitations = new Map();
            citations.forEach(c => uniqueCitations.set(c.uri, c));
            citations = Array.from(uniqueCitations.values());
        }

    } catch (e) {
        console.warn("Content analysis failed, falling back to direct URL prompt", e);
        structuralSummary = `Create a professional infographic about the content at this link: ${url}. Ensure the text is in ${language}.`;
    }

    // PHASE 2: Visual Synthesis (The "Artist")
    if (onProgress) onProgress("DESIGNING & RENDERING INFOGRAPHIC...");

    let styleGuidelines = "";
    switch (style) {
        case "Fun & Playful":
            styleGuidelines = `STYLE: Vibrant 2D vector illustrations, rounded shapes, friendly tone, high saturation colors.`;
            break;
        case "Clean Minimalist":
            styleGuidelines = `STYLE: Ultra-minimalist, maximum whitespace, 1 accent color, thin geometric lines, sophisticated airy feel.`;
            break;
        case "Dark Mode Tech":
            styleGuidelines = `STYLE: Dark slate background, glowing neon highlights (cyan/lime), futuristic data-driven aesthetic.`;
            break;
        case "Modern Editorial":
            styleGuidelines = `STYLE: High-end magazine illustration, flat design, cohesive mature color palette, professional balance.`;
            break;
        case "Corporate Professional":
            styleGuidelines = `STYLE: Trustworthy business style, navy blues and greys, structured grid, standard professional icons.`;
            break;
        case "Hand-Drawn Sketchnote":
            styleGuidelines = `STYLE: Hand-drawn marker on whiteboard style, casual doodles, organic arrows, hand-lettered fonts.`;
            break;
        case "Retro Pixel Art":
            styleGuidelines = `STYLE: 8-bit or 16-bit retro aesthetic, blocky pixel fonts, limited classic gaming color palette.`;
            break;
        case "Watercolor Artistic":
            styleGuidelines = `STYLE: Soft hand-painted watercolor textures, fluid edges, pastel washes, artistic and organic.`;
            break;
        case "Abstract Geometric":
            styleGuidelines = `STYLE: Bauhaus influence, bold primary color shapes, abstract composition of circles and triangles.`;
            break;
        case "Futuristic ISO":
            styleGuidelines = `STYLE: 3D isometric perspective, high-tech blueprint look, glass textures, depth and layering.`;
            break;
        case "Paper Cutout":
            styleGuidelines = `STYLE: Layered paper-cut aesthetic, physical shadows between elements, craft paper textures.`;
            break;
        case "Pop Art":
            styleGuidelines = `STYLE: High-contrast comic style, Ben-Day dots, bold black outlines, extremely vibrant primary colors.`;
            break;
        case "Vintage Newspaper":
            styleGuidelines = `STYLE: Aged newsprint texture, monochromatic black-and-white ink, classical typography, lithographic feel.`;
            break;
        case "Cyberpunk Glow":
            styleGuidelines = `STYLE: Neon-noir aesthetic, intense magenta and electric blue, glitch effects, dark moody atmosphere.`;
            break;
        case "Steampunk Brass":
            styleGuidelines = `STYLE: Victorian industrial aesthetic, brass gears, sepia tones, copper pipes, intricate mechanical details.`;
            break;
        case "Synthwave 80s":
            styleGuidelines = `STYLE: Retro-futuristic 80s style, neon grids, synth sunsets, chrome text, vibrant purple and orange.`;
            break;
        case "Origami Fold":
            styleGuidelines = `STYLE: Folded paper aesthetic, sharp geometric shadows, clean pastel colors, 3D papercraft feel.`;
            break;
        case "Stained Glass":
            styleGuidelines = `STYLE: Vibrant mosaic of colored glass panes separated by dark lead lines, luminous and colorful.`;
            break;
        case "Chalkboard Sketch":
            styleGuidelines = `STYLE: Dusty blackboard background with white and colored chalk illustrations, hand-drawn educational feel.`;
            break;
        default:
             if (style && style !== "Custom") {
                styleGuidelines = `STYLE: Custom User Style Preference: "${style}".`;
             } else {
                styleGuidelines = `STYLE: Modern, flat vector illustration style, clean and professional.`;
             }
            break;
    }

    const imagePrompt = `Render a high-resolution professional infographic based on this information architecture:

    ${structuralSummary}

    VISUAL EXECUTION RULES:
    - ${styleGuidelines}
    - LANGUAGE: EVERY PIECE OF TEXT IN THE IMAGE MUST BE IN ${language}.
    - LAYOUT: Use the "VISUAL METAPHOR IDEA" suggested in the plan.
    - READABILITY: Headline must be very large. Sections must be clearly separated.
    - OUTPUT: Generate a single clear image that summarizes the key takeaways.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [{ text: imagePrompt }],
            },
            config: {
                imageConfig: {
                    aspectRatio: "3:4",
                    imageSize: "1K"
                }
            },
        });

        let imageData = null;
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    imageData = part.inlineData.data;
                    break;
                }
            }
        }
        return { imageData, citations };
    } catch (error) {
        console.error("Article infographic generation failed:", error);
        throw error;
    }
}

export async function editImageWithGemini(base64Data: string, mimeType: string, prompt: string): Promise<string | null> {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini image editing failed:", error);
    throw error;
  }
}
