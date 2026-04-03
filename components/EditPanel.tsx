
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { EditPlan, AnalysisSession } from '../types/editing';
import { generateEditPlan } from '../services/editService';
import { Wand2, Send, History, AlertTriangle, Check, X, Loader2, ArrowRight } from 'lucide-react';

interface EditPanelProps {
  session: AnalysisSession;
  onApplyPlan: (plan: EditPlan) => void;
  onRevert: (versionId: string) => void;
}

const EditPanel: React.FC<EditPanelProps> = ({ session, onApplyPlan, onRevert }) => {
  const [instruction, setInstruction] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<EditPlan | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const currentVersion = session.versions[session.currentVersionId];

  const handleEstimate = async () => {
    if (!instruction.trim()) return;
    setIsPlanning(true);
    try {
      const plan = await generateEditPlan(
        instruction,
        currentVersion.spec,
        currentVersion.render2D,
        currentVersion.render3D
      );
      setCurrentPlan(plan);
    } catch (e) {
      console.error(e);
      // In a real app, show error toast
    } finally {
      setIsPlanning(false);
    }
  };

  const handleCommit = () => {
    if (currentPlan) {
      onApplyPlan(currentPlan);
      setCurrentPlan(null);
      setInstruction('');
    }
  };

  const handleDiscard = () => {
    setCurrentPlan(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/50 border-l border-white/5 backdrop-blur-sm w-full md:w-80 shrink-0 transition-all">
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-400" /> Natural Edit
        </h3>
        <button 
           onClick={() => setShowHistory(!showHistory)}
           className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
           title="Version History"
        >
           <History className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {showHistory ? (
           <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
              <h4 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Version Timeline</h4>
              {session.history.slice().reverse().map((vid, idx) => {
                  const ver = session.versions[vid];
                  const isCurrent = vid === session.currentVersionId;
                  return (
                      <div key={vid} className={`p-3 rounded-xl border transition-all ${isCurrent ? 'bg-violet-500/10 border-violet-500/30' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}>
                          <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-white truncate max-w-[140px]">{ver.commitMessage}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{new Date(ver.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {!isCurrent && (
                              <button 
                                onClick={() => onRevert(vid)}
                                className="mt-2 text-[10px] flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 bg-white/5 rounded-md w-full justify-center hover:bg-white/10 transition-colors"
                              >
                                  <History className="w-3 h-3" /> Revert to this
                              </button>
                          )}
                      </div>
                  )
              })}
           </div>
        ) : (
          <>
             {/* Planning Result Card */}
             {currentPlan ? (
                 <div className="bg-slate-900/80 border border-violet-500/30 rounded-xl p-4 space-y-4 animate-in fade-in zoom-in-95 shadow-2xl">
                    <div className="flex items-start gap-3">
                       <div className={`p-2 rounded-lg ${currentPlan.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                           {currentPlan.riskLevel === 'high' ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                       </div>
                       <div>
                           <h4 className="text-sm font-bold text-white leading-tight">{currentPlan.intentSummary}</h4>
                           <p className="text-xs text-slate-400 mt-1">Est. Cost: <span className="text-white font-mono">${currentPlan.estimatedCostUSD.toFixed(4)}</span></p>
                       </div>
                    </div>
                    
                    <div className="space-y-2">
                        {currentPlan.requiresRegeneration && (
                            <div className="text-[10px] bg-red-500/10 text-red-300 px-2 py-1.5 rounded border border-red-500/20">
                                ⚠️ Requires 3D Regeneration
                            </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-500 bg-black/20 p-2 rounded">
                            {currentPlan.patches.flatMap(p => p.ops).length} ops queued
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button 
                           onClick={handleDiscard}
                           className="py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                           onClick={handleCommit}
                           className="py-2 px-3 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-1"
                        >
                            Apply <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                 </div>
             ) : (
                 <div className="text-center py-8 text-slate-600 space-y-2">
                     <Wand2 className="w-8 h-8 mx-auto opacity-20" />
                     <p className="text-xs">Describe changes naturally.</p>
                     <p className="text-[10px] opacity-50">"Rename the Auth node to 'Identity Service'"</p>
                 </div>
             )}
          </>
        )}
      </div>

      {/* Input Area */}
      {!showHistory && !currentPlan && (
          <div className="p-4 bg-slate-900/50 border-t border-white/5">
            <div className="relative">
                <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Describe edits..."
                    disabled={isPlanning}
                    className="w-full h-24 bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:ring-1 focus:ring-violet-500/50 resize-none font-mono"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEstimate();
                        }
                    }}
                />
                <div className="absolute bottom-2 right-2">
                    <button 
                       onClick={handleEstimate}
                       disabled={!instruction.trim() || isPlanning}
                       className="p-2 bg-violet-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-800 transition-all hover:bg-violet-400 shadow-lg"
                    >
                        {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
             <p className="text-[10px] text-slate-500 mt-2 text-center">
                 Pre-flight estimate provided before applying.
             </p>
          </div>
      )}
    </div>
  );
};

export default EditPanel;
