
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { fetchRepoFileTree } from '../services/githubService';
import { generateInfographic, generateBlueprintSpec } from '../services/geminiService';
import { applyPatches } from '../services/editService';
import { RepoFileTree, ViewMode, RepoHistoryItem } from '../types';
import { BlueprintSpec, AnalysisSession, EditPlan, AnalysisVersion } from '../types/editing';
import { AlertCircle, Loader2, Layers, Box, Download, Sparkles, Command, Clock, Maximize, Save, GitBranch } from 'lucide-react';
import { LoadingState } from './LoadingState';
import ImageViewer from './ImageViewer';
import EditPanel from './EditPanel';
import D3FlowChart from './D3FlowChart';

interface RepoAnalyzerProps {
  onNavigate: (mode: ViewMode, data?: any) => void;
  history: RepoHistoryItem[];
  onAddToHistory: (item: RepoHistoryItem) => void;
}

const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ onNavigate, history, onAddToHistory }) => {
  const [repoInput, setRepoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>('');
  
  // New Hybrid State
  const [session, setSession] = useState<AnalysisSession | null>(null);
  
  const [generating3D, setGenerating3D] = useState(false);
  const [selected3DStyle, setSelected3DStyle] = useState('Futuristic ISO');
  const [selectedCameraAngle, setSelectedCameraAngle] = useState('Isometric');
  const [currentFileTree, setCurrentFileTree] = useState<RepoFileTree[] | null>(null);
  const [currentRepoName, setCurrentRepoName] = useState<string>('');
  const [fullScreenImage, setFullScreenImage] = useState<{src: string, alt: string} | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  React.useEffect(() => {
    const checkKey = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    setHasApiKey(true);
  };

  const parseRepoInput = (input: string): { owner: string, repo: string } | null => {
    const cleanInput = input.trim().replace(/\/$/, '');
    try {
      const url = new URL(cleanInput);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
      }
    } catch (e) { }
    const parts = cleanInput.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1] };
    return null;
  };

  const createInitialSession = (repoName: string, spec: BlueprintSpec): AnalysisSession => {
      const vid = Date.now().toString();
      return {
          id: vid,
          repoName,
          currentVersionId: vid,
          versions: {
              [vid]: {
                  id: vid,
                  timestamp: Date.now(),
                  spec,
                  render2D: {
                      theme: 'cyberpunk',
                      showLabels: true,
                      fontSize: 12,
                      nodeSizeScale: 1,
                      edgeWidthScale: 1
                  },
                  render3D: {
                      style: 'default',
                      cameraAngle: 'isometric',
                      lighting: 'studio',
                      regenerateOnTextChange: true
                  },
                  commitMessage: 'Initial Analysis',
                  costUSD: 0.05
              }
          },
          history: [vid]
      };
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSession(null);
    setCurrentFileTree(null);

    const repoDetails = parseRepoInput(repoInput);
    if (!repoDetails) {
      setError('Invalid format. Use "owner/repo" or a full GitHub URL.');
      return;
    }

    setLoading(true);
    setCurrentRepoName(repoDetails.repo);
    try {
      setLoadingStage('CONNECTING TO GITHUB');
      const fileTree = await fetchRepoFileTree(repoDetails.owner, repoDetails.repo);
      if (fileTree.length === 0) throw new Error('No relevant code files found.');
      setCurrentFileTree(fileTree);

      setLoadingStage('EXTRACTING BLUEPRINT');
      // Step 1: Generate the Blueprint JSON (Spec)
      const spec = await generateBlueprintSpec(repoDetails.repo, fileTree);
      
      // Initialize Session
      setSession(createInitialSession(repoDetails.repo, spec));

      // Add to history immediately for access later
      onAddToHistory({
          id: Date.now().toString(),
          repoName: repoDetails.repo,
          imageData: "", // Placeholder, 2D is live
          is3D: false,
          style: "Blueprint",
          date: new Date()
      });
      
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleApplyEdit = (plan: EditPlan) => {
     if (!session) return;
     
     const currentVer = session.versions[session.currentVersionId];
     
     // 1. Create Clones
     let newSpec = JSON.parse(JSON.stringify(currentVer.spec));
     let newRender2D = JSON.parse(JSON.stringify(currentVer.render2D));
     let newRender3D = JSON.parse(JSON.stringify(currentVer.render3D));
     
     // 2. Apply Patches
     plan.patches.forEach(group => {
         if (group.target === 'spec') newSpec = applyPatches(newSpec, group.ops);
         if (group.target === 'render2D') newRender2D = applyPatches(newRender2D, group.ops);
         if (group.target === 'render3D') newRender3D = applyPatches(newRender3D, group.ops);
     });
     
     // 3. Create New Version
     const newVid = Date.now().toString();
     const newVer: AnalysisVersion = {
         id: newVid,
         timestamp: Date.now(),
         spec: newSpec,
         render2D: newRender2D,
         render3D: newRender3D,
         commitMessage: plan.intentSummary,
         costUSD: plan.estimatedCostUSD,
         imageData3D: plan.requiresRegeneration ? undefined : currentVer.imageData3D // Keep old image if no regen needed
     };
     
     setSession({
         ...session,
         currentVersionId: newVid,
         versions: { ...session.versions, [newVid]: newVer },
         history: [...session.history, newVid]
     });
  };

  const handleRevert = (vid: string) => {
      if (session && session.versions[vid]) {
          setSession({
              ...session,
              currentVersionId: vid
          });
      }
  };

  const handleGenerate3D = async () => {
    if (!currentFileTree || !currentRepoName || !session) return;
    setGenerating3D(true);
    try {
      const data = await generateInfographic(currentRepoName, currentFileTree, selected3DStyle, true, "English", selectedCameraAngle);
      if (data) {
          // Update current version with the image
          const vid = session.currentVersionId;
          const updatedVer = { ...session.versions[vid], imageData3D: data };
          setSession({
              ...session,
              versions: { ...session.versions, [vid]: updatedVer }
          });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating3D(false);
    }
  };

  // --- SAVE FUNCTIONS ---
  const handleSave2D = () => {
    const container = document.getElementById('d3-canvas-container');
    const svgElement = container?.querySelector('svg');
    
    if (!svgElement || !session) return;
    
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale up for better quality
        const scale = 2;
        canvas.width = (svgElement.clientWidth || 800) * scale; 
        canvas.height = (svgElement.clientHeight || 600) * scale;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.scale(scale, scale);
            // Draw background
            ctx.fillStyle = "#020617"; // Match slate-950
            ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
            ctx.drawImage(img, 0, 0);
            
            const pngUrl = canvas.toDataURL("image/png");
            const a = document.createElement('a');
            a.download = `${session.repoName}-blueprint-2d.png`;
            a.href = pngUrl;
            a.click();
        }
        URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleSave3D = () => {
    if (activeVersion?.imageData3D && session) {
       const a = document.createElement('a');
       a.href = `data:image/png;base64,${activeVersion.imageData3D}`;
       a.download = `${session.repoName}-hologram-3d.png`;
       a.click();
    }
  };

  const activeVersion = session ? session.versions[session.currentVersionId] : null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 mb-20 px-4">
      
      {fullScreenImage && (
          <ImageViewer 
            src={fullScreenImage.src} 
            alt={fullScreenImage.alt} 
            onClose={() => setFullScreenImage(null)} 
          />
      )}

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500 font-sans">
          Codebase <span className="text-violet-400">Intelligence</span>.
        </h2>
      </div>

      {/* Input Section */}
      {!session && (
          <div className="max-w-xl mx-auto relative z-10 animate-in fade-in slide-in-from-bottom-4">
            <form onSubmit={handleAnalyze} className="glass-panel rounded-2xl p-2 transition-all focus-within:ring-1 focus-within:ring-violet-500/50 focus-within:border-violet-500/50">
            <div className="flex items-center">
                <div className="pl-3 text-slate-500">
                    <Command className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repository"
                    className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 text-lg px-4 py-2 font-mono"
                />
                <div className="pr-2">
                    <button
                    type="submit"
                    disabled={loading || !repoInput.trim()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-white/10 font-mono text-sm"
                    >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "RUN_ANALYSIS"}
                    </button>
                </div>
            </div>
            </form>
          </div>
      )}

      {loading && (
        <LoadingState message={loadingStage} type="repo" />
      )}

      {error && (
        <div className="max-w-2xl mx-auto p-4 glass-panel border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 font-mono text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <p>{error}</p>
        </div>
      )}

      {/* WORKSPACE AREA */}
      {session && activeVersion && (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* MAIN WORKSPACE WRAPPER */}
            {/* Changed from fixed h-[800px] to min-h-[800px] to prevent clipping */}
            <div className="flex flex-col lg:flex-row min-h-[800px] glass-panel rounded-3xl overflow-hidden bg-slate-950/40 border border-white/5">
                
                {/* LEFT COLUMN: Visuals (2D + 3D) */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-950/30 border-r border-white/5">
                    {/* Workspace Header */}
                    <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-slate-300 font-mono flex items-center gap-2">
                                 <Layers className="w-4 h-4 text-violet-400" /> 
                                 {activeVersion.spec.title || session.repoName}
                            </span>
                            <span className="text-[10px] bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20 font-mono">
                                v{session.history.indexOf(session.currentVersionId) + 1}
                            </span>
                        </div>
                    </div>

                    {/* Canvases Container */}
                    <div className="flex-1 flex flex-col lg:flex-row">
                        
                        {/* 2D CANVAS PANEL */}
                        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 min-h-[400px] relative bg-[#0f172a] group">
                            {/* 2D Header Actions */}
                            <div className="absolute top-4 left-4 z-20 pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/5">2D Blueprint</span>
                            </div>
                            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={handleSave2D}
                                    className="p-2 bg-slate-800/80 hover:bg-violet-600 text-white rounded-lg backdrop-blur-md border border-white/10 transition-colors shadow-lg"
                                    title="Save as PNG"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            </div>
                            
                            {/* D3 Content */}
                            <div id="d3-canvas-container" className="flex-1 w-full h-full">
                                <D3FlowChart data={activeVersion.spec} />
                            </div>
                        </div>

                        {/* 3D CANVAS PANEL */}
                        <div className="flex-1 flex flex-col min-h-[400px] relative bg-slate-900/50 group flex items-center justify-center">
                             {/* 3D Header Actions */}
                             <div className="absolute top-4 left-4 z-20 pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/5">3D Hologram</span>
                            </div>
                             
                             {activeVersion.imageData3D ? (
                                 <div className="w-full h-full relative">
                                     <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                            onClick={handleSave3D}
                                            className="p-2 bg-slate-800/80 hover:bg-violet-600 text-white rounded-lg backdrop-blur-md border border-white/10 transition-colors shadow-lg"
                                            title="Save as PNG"
                                         >
                                             <Download className="w-4 h-4" />
                                         </button>
                                         <button 
                                            onClick={() => alert("Download placeholder: glTF/OBJ export not yet implemented.")}
                                            className="p-2 bg-slate-800/80 hover:bg-violet-600 text-white rounded-lg backdrop-blur-md border border-white/10 transition-colors shadow-lg"
                                            title="Download 3D Model"
                                         >
                                             <Box className="w-4 h-4" />
                                         </button>
                                         <button 
                                            onClick={() => setFullScreenImage({src: `data:image/png;base64,${activeVersion.imageData3D!}`, alt: '3D View'})}
                                            className="p-2 bg-slate-800/80 hover:bg-white/20 text-white rounded-lg backdrop-blur-md border border-white/10 transition-colors shadow-lg"
                                            title="Fullscreen"
                                         >
                                             <Maximize className="w-4 h-4" />
                                         </button>
                                     </div>
                                     <img src={`data:image/png;base64,${activeVersion.imageData3D}`} className="w-full h-full object-cover" />
                                 </div>
                             ) : generating3D ? (
                                 <div className="flex flex-col items-center gap-2">
                                     <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
                                     <span className="text-xs font-mono text-fuchsia-300 animate-pulse">RENDERING...</span>
                                 </div>
                             ) : (
                                 <div className="flex flex-col items-center gap-4 p-6 w-full max-w-xs">
                                     <div className="w-full space-y-2">
                                         <label className="text-[10px] text-slate-500 font-mono">3D STYLE</label>
                                         <select 
                                            value={selected3DStyle} 
                                            onChange={(e) => setSelected3DStyle(e.target.value)}
                                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                                         >
                                             <option value="Futuristic ISO">Futuristic ISO - High-tech blueprint look, glass textures, depth and layering.</option>
                                             <option value="Cyberpunk Glow">Cyberpunk Glow - Neon-noir aesthetic, intense magenta and electric blue, glitch effects.</option>
                                             <option value="Claymation">Claymation - Soft, rounded shapes, matte clay textures, playful and tactile.</option>
                                             <option value="Wireframe">Wireframe - Minimalist geometric lines, transparent surfaces, technical structure.</option>
                                         </select>
                                     </div>
                                     <div className="w-full space-y-2">
                                         <label className="text-[10px] text-slate-500 font-mono">CAMERA ANGLE</label>
                                         <select 
                                            value={selectedCameraAngle} 
                                            onChange={(e) => setSelectedCameraAngle(e.target.value)}
                                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                                         >
                                             <option value="Isometric">Isometric</option>
                                             <option value="Top-Down">Top-Down</option>
                                             <option value="Front-Facing">Front-Facing</option>
                                             <option value="Dynamic">Dynamic</option>
                                         </select>
                                     </div>
                                     <button 
                                        onClick={handleGenerate3D}
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl hover:bg-white/5 transition-all group w-full"
                                     >
                                         <Box className="w-8 h-8 text-slate-600 group-hover:text-fuchsia-400 transition-colors" />
                                         <span className="text-xs font-mono text-slate-500 group-hover:text-white">Generate Hologram</span>
                                     </button>
                                 </div>
                              )
                             }
                        </div>

                    </div>
                </div>

                {/* RIGHT COLUMN: Edit Panel */}
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/5 bg-slate-950/50 backdrop-blur-sm">
                    <EditPanel 
                        session={session}
                        onApplyPlan={handleApplyEdit}
                        onRevert={handleRevert}
                    />
                </div>

            </div>

            {/* HISTORY / RECENT BLUEPRINTS SECTION (Previously Missing) */}
            {history.length > 0 && (
                <div className="pt-8 border-t border-white/5 animate-in fade-in">
                    <div className="flex items-center gap-2 mb-6 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <h3 className="text-sm font-mono uppercase tracking-wider">Recent Blueprints</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {history.slice(0, 4).map((item) => (
                            <button 
                                key={item.id}
                                disabled={true} // For now, just display as we don't have full hydration logic for history items in this stateless view
                                className="group bg-slate-900/50 border border-white/5 hover:border-violet-500/30 rounded-xl overflow-hidden text-left transition-all p-4 flex items-center gap-4 opacity-75 hover:opacity-100"
                            >
                                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
                                    <GitBranch className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate font-mono">{item.repoName}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{new Date(item.date).toLocaleDateString()}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

        </div>
      )}
    </div>
  );
};

export default RepoAnalyzer;
