/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  User, Shield, Key, Sparkles, BookOpen, Clock, Heart, 
  Map, MessageSquare, ArrowRight, CornerDownRight, RefreshCw, AlertCircle
} from "lucide-react";
import { Character, GameState } from "../types";

interface DramaLogItem {
  promptId: string;
  prefix: string;
  action_instructions: string[];
  spoken_prompt: string | string[];
  postfix: string;
  social_structure?: string;
  mechanical_structure?: string;
  target_of_action_desc?: string;
  timestamp: number;
}

interface ActiveGameProps {
  game: GameState;
  character: Character;
  onCompletePrompt: (semanticInput: string) => Promise<void>;
  onRetryGeneration: () => Promise<void>;
  isCompleting: boolean;
  gameId: string;
  onLeaveGame: () => void;
  promptError: string | null;
  clearPromptError: () => void;
}

export default function ActiveGame({
  game,
  character,
  onCompletePrompt,
  onRetryGeneration,
  isCompleting,
  gameId,
  onLeaveGame,
  promptError,
  clearPromptError
}: ActiveGameProps) {
  const [semanticInput, setSemanticInput] = useState("");
  const [activeTab, setActiveTab] = useState<"prompt" | "relationships" | "world">("prompt");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<DramaLogItem[]>([]);

  // Capture current prompts into local/localStorage chronological history logs
  useEffect(() => {
    if (!character.character_id) return;
    const cacheKey = `elopeli_history_log_${character.character_id}`;
    const cached = localStorage.getItem(cacheKey);
    let loaded: DramaLogItem[] = cached ? JSON.parse(cached) : [];
    
    // Check if the current prompt is present; if not, merge/append it
    if (character.current_prompt) {
      const p = character.current_prompt.player_prompt;
      const keyString = Array.isArray(p.spoken_prompt) ? p.spoken_prompt.join('|') : p.spoken_prompt;
      const alreadyExists = loaded.some(item => {
        const itemKey = Array.isArray(item.spoken_prompt) ? item.spoken_prompt.join('|') : item.spoken_prompt;
        return itemKey === keyString;
      });
      if (!alreadyExists && keyString) {
        loaded.push({
          promptId: `pr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          prefix: p.prefix,
          action_instructions: p.action_instruction,
          spoken_prompt: p.spoken_prompt,
          postfix: p.postfix,
          social_structure: character.current_prompt.social_structure || "keskusteleva",
          mechanical_structure: character.current_prompt.mechanical_structure || "dialogi",
          target_of_action_desc: character.current_prompt.target_of_action?.description || "Kohtaus / Kaikki",
          timestamp: Date.now()
        });
        localStorage.setItem(cacheKey, JSON.stringify(loaded));
      }
    }
    setHistoryLogs(loaded);
  }, [character.character_id, character.current_prompt]);

  // Character Shell (Lataustila)
  if (character.status === "shell") {
    return (
      <div className="max-w-md mx-auto py-8 px-4 text-center space-y-6" id="shell-waiting-screen">
        <div className="relative inline-flex items-center justify-center p-6 bg-green-500/5 border border-green-500/20 rounded-full">
          <span className="absolute inline-flex h-20 w-20 rounded-full bg-green-500/20 animate-ping"></span>
          <User className="text-elopeli-primary animate-pulse" size={32} />
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white uppercase glow-primary">
            Räätälöidään hahmoasi...
          </h2>
          <p className="text-stone-300 text-sm">
            Terve {character.player_name}! Laitteellesi on varattu <b>character shell</b>.
          </p>
          <p className="text-stone-400 text-xs text-left bg-stone-950/60 p-5 border border-stone-850 rounded font-mono leading-relaxed max-w-sm mx-auto mt-4">
            Kielimalli sovittaa sinut osaksi skenaariota: <br/>
            <span className="text-stone-300">"{game.game_premise}"</span>. <br/><br/>
            Yhdistetään suhteita muihin pelaajiin ja luodaan sinulle tavoite, 
            salaisuus ja ensimmäinen tilanneprompti...
          </p>
        </div>

        <div className="flex flex-col gap-2 max-w-xs mx-auto pt-4">
          <div className="flex justify-center items-center gap-2 text-xs font-mono text-stone-400">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Odotetaan pelimoottorin JSON-vastausta...
          </div>
          
          <button
            onClick={onRetryGeneration}
            className="mt-6 py-2 px-3 border border-stone-800 rounded bg-stone-900/60 text-stone-400 hover:text-white font-mono text-xs flex items-center justify-center gap-1.5 self-center cursor-pointer hover:bg-stone-900"
            id="retry-char-gen-btn"
          >
            <RefreshCw size={12} /> Lataako liian pitkään? Yritä uudelleen
          </button>
        </div>
      </div>
    );
  }

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleting) return;
    await onCompletePrompt(semanticInput);
    setSemanticInput(""); // Clear typing
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-3" id="active-game-section">
      
      {/* Mobile character HUD */}
      <div 
        className="bg-game-card mb-4 rounded-lg p-5 border relative overflow-hidden transition-all shadow-xl"
        style={{ borderColor: "var(--elopeli-primary, #22c55e)" }}
        id="character-hud-card"
      >
        <div className="absolute top-2 right-3 font-mono text-[9px] text-green-400/70 bg-green-500/5 px-2 py-0.5 rounded border border-green-500/10">
          PIN: {gameId}
        </div>

        <div className="flex items-start gap-4">
          <div 
            className="p-3 rounded bg-stone-950 border shrink-0 text-white shadow-md"
            style={{ borderColor: "var(--elopeli-accent, #16a34a)" }}
          >
            <User size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-mono text-stone-500 tracking-wider">
              {character.role}
            </div>
            <h3 className="font-display text-2xl font-bold text-white leading-tight mt-0.5">
              {character.name}
            </h3>
            <p className="text-stone-300 text-sm mt-1.5 italic font-sans leading-relaxed">
              "{character.description}"
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-stone-900/60 space-y-3.5 text-xs">
          <div>
            <span className="font-mono text-[10px] text-stone-500 uppercase block tracking-wider">Nykyinen tavoite:</span>
            <p className="text-white text-[14px] font-sans font-semibold mt-0.5 leading-relaxed" id="character-active-goal">
              {character.goal}
            </p>
          </div>
          <div className="pt-2.5 border-t border-stone-850/40">
            <span className="font-mono text-[10px] text-stone-500 uppercase block tracking-wider">Dramaturginen ankkuri:</span>
            <span className="text-stone-300 font-mono text-[11px] block mt-0.5" id="dramaturgical-anchor-span" title={character.dramaturgical_anchor}>
              🔒 {character.dramaturgical_anchor}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs list (Prompt, relationships, world state) */}
      <div className="flex border-b border-stone-900 mb-5 text-sm font-mono">
        <button
          onClick={() => setActiveTab("prompt")}
          className={`flex-1 py-3 text-center border-b-2 font-semibold transition-all cursor-pointer ${
            activeTab === "prompt" 
              ? "text-white border-elopeli-primary text-base" 
              : "text-stone-500 border-transparent hover:text-stone-300"
          }`}
          id="tab-btn-prompt"
        >
          🎭 Vuorosi (Cue)
        </button>
        <button
          onClick={() => setActiveTab("relationships")}
          className={`flex-1 py-3 text-center border-b-2 font-semibold transition-all cursor-pointer ${
            activeTab === "relationships" 
              ? "text-white border-elopeli-primary text-base" 
              : "text-stone-500 border-transparent hover:text-stone-300"
          }`}
          id="tab-btn-relationships"
        >
          ❤️ Suhteet ({character.relationships.length})
        </button>
        <button
          onClick={() => setActiveTab("world")}
          className={`flex-1 py-3 text-center border-b-2 font-semibold transition-all cursor-pointer ${
            activeTab === "world" 
              ? "text-white border-elopeli-primary text-base" 
              : "text-stone-500 border-transparent hover:text-stone-300"
          }`}
          id="tab-btn-world"
        >
          🌍 Tilanne
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "prompt" && (
        <div className="space-y-4" id="prompt-tab-panel">
          
          {historyLogs.length === 0 ? (
            <div className="bg-game-card border border-stone-850 rounded p-6 text-center space-y-2">
              <AlertCircle className="mx-auto text-yellow-500" size={24} />
              <p className="font-mono text-xs text-stone-350">
                Peli etenee tai olet suorittanut kaikki vuorosi. Odotetaan...
              </p>
              <button
                onClick={() => onRetryGeneration()}
                className="py-1 px-3 bg-stone-900 text-stone-300 font-mono text-[10px] rounded hover:text-white mx-auto cursor-pointer"
                id="refresh-prompt-active-btn"
              >
                Päivitä tai pyydä uusi vuoro lennosta
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              
              {/* Title Header */}
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-mono uppercase text-stone-500 tracking-wider">
                  Käsikirjoitus / Roolihistoria ({historyLogs.length} vuoroa)
                </span>
                <span className="text-[9px] bg-green-500/15 text-green-400 font-mono px-2 py-0.5 rounded uppercase font-semibold">
                  Juokseva kerronta
                </span>
              </div>

              {/* Chronological logs feed */}
              <div className="space-y-4" id="chat-style-script-history">
                {historyLogs.map((log, idx) => {
                  const isLast = idx === historyLogs.length - 1;
                  
                  if (!isLast) {
                    // Previous logs rendered beautifully in quiet collapsed state
                    return (
                      <div 
                        key={log.promptId} 
                        className="bg-stone-950/40 border border-stone-900 rounded-lg p-4 font-sans space-y-2 opacity-50 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex justify-between items-center text-[10px] font-mono text-stone-600">
                          <span>LAUSUTTU VUORO #{idx + 1}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <blockquote className="text-[13px] text-stone-350 italic border-l-2 border-stone-850 pl-2 leading-relaxed">
                          {log.spoken_prompt}
                        </blockquote>
                        {log.postfix && (
                          <p className="text-[11px] text-stone-500 leading-normal">
                            👉 {log.postfix}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // The very last item in timeline (active segment or compiling state)
                  return (
                    <div key={log.promptId} className="space-y-4">
                      
                      {/* Active Cue Card */}
                      <div className="bg-game-card border border-elopeli-primary/50 rounded-lg p-5 space-y-4 shadow-2xl relative">
                        {/* Glowing active indicator dot */}
                        <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>

                        {/* Dynamic Setting Taxonomy Header */}
                        <div className="grid grid-cols-3 gap-2 pb-3 text-center text-[10px] font-mono leading-tight border-b border-stone-850/50">
                          <div className="bg-stone-950/45 p-2 rounded border border-stone-850/20 text-left">
                            <span className="text-stone-550 block mb-0.5 uppercase tracking-wider text-[9px]">Kohde:</span>
                            <strong className="text-white font-bold block truncate text-[11px]" title={log.target_of_action_desc || "Koko tilanne"}>
                              🎯 {log.target_of_action_desc || "Koko tilanne"}
                            </strong>
                          </div>
                          <div className="bg-stone-950/45 p-2 rounded border border-stone-850/20 text-left">
                            <span className="text-stone-550 block mb-0.5 uppercase tracking-wider text-[9px]">Suhde:</span>
                            <strong className="text-[var(--elopeli-primary,#22c55e)] font-bold block truncate text-[11px]" title={log.social_structure || "Yleinen"}>
                              🔗 {log.social_structure || "Yleinen"}
                            </strong>
                          </div>
                          <div className="bg-stone-950/45 p-2 rounded border border-stone-850/20 text-left">
                            <span className="text-stone-550 block mb-0.5 uppercase tracking-wider text-[9px]">Mekaniikka:</span>
                            <strong className="text-yellow-600 font-bold block truncate text-[11px]" title={log.mechanical_structure || "Dialogi"}>
                              🎲 {log.mechanical_structure || "Dialogi"}
                            </strong>
                          </div>
                        </div>

                        {/* Combined simple silent reading box */}
                        <div className="bg-stone-950/60 p-4 rounded border border-stone-850/40 space-y-2 font-sans" id="prompt-combination-field">
                          <div className="text-[11px] font-mono text-[var(--elopeli-primary,#22c55e)] uppercase tracking-wider font-bold">
                            📖 Lue hiljaa (Hahmosi asenne &amp; näkökulma):
                          </div>
                          <p className="text-stone-300 text-xs italic font-sans leading-relaxed">
                            {log.prefix}
                          </p>
                          {log.action_instructions.length > 0 && (
                            <div className="pt-1.5 border-t border-stone-900/40 text-[11px] text-stone-400 font-sans space-y-1">
                              {log.action_instructions.map((ai, instructionIdx) => (
                                <div key={instructionIdx} className="flex items-start gap-1.5 leading-relaxed">
                                  <span className="text-stone-500 font-bold">•</span>
                                  <span>{ai}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Step-by-step spoken cues and physical acts (Supports 0 to 3 elements) */}
                        <div className="space-y-3" id="prompt-actions-step-list-unified">
                          <div className="text-[10px] font-mono text-green-400/95 font-bold tracking-wider uppercase px-0.5">
                            ⚡ Sano tai toteuta muiden nähden:
                          </div>

                          {Array.isArray(log.spoken_prompt) ? (
                            log.spoken_prompt.length === 0 ? (
                              <p className="text-xs text-stone-500 italic pl-1 leading-relaxed">
                                Ei erityisiä pakollisia vuorosanoja. Toimi vapaasti tilanteen herättämällä tavalla muiden kanssa.
                              </p>
                            ) : (
                              <div className="space-y-2.5">
                                {log.spoken_prompt.map((step, stepId) => {
                                  // Determine step execution style
                                  let isDialogue = false;
                                  let isPhysical = false;
                                  let cleanStep = step;

                                  if (/^\s*\*\*?Puhe:\*\*?\s*/i.test(step)) {
                                    isDialogue = true;
                                    cleanStep = step.replace(/^\s*\*\*?Puhe:\*\*?\s*/i, "");
                                  } else if (/^\s*\*\*?Toiminta:\*\*?\s*/i.test(step)) {
                                    isPhysical = true;
                                    cleanStep = step.replace(/^\s*\*\*?Toiminta:\*\*?\s*/i, "");
                                  } else if (step.toLowerCase().startsWith("puhe:")) {
                                    isDialogue = true;
                                    cleanStep = step.substring(5).trim();
                                  } else if (step.toLowerCase().startsWith("toiminta:")) {
                                    isPhysical = true;
                                    cleanStep = step.substring(9).trim();
                                  } else if (step.includes('"') || step.includes('”')) {
                                    isDialogue = true;
                                  } else {
                                    isPhysical = true;
                                  }

                                  return (
                                    <div 
                                      key={stepId} 
                                      className={`p-3.5 rounded border transition-colors cursor-pointer relative group text-left ${
                                        isDialogue 
                                          ? "border-green-500/20 bg-green-500/[0.03] hover:bg-green-500/[0.07]"
                                          : isPhysical
                                          ? "border-yellow-500/[0.12] bg-yellow-500/[0.01] hover:bg-yellow-500/[0.04]"
                                          : "border-stone-850 bg-stone-900/10 hover:bg-stone-950"
                                      }`}
                                      onClick={() => {
                                        navigator.clipboard.writeText(cleanStep.replace(/^"|"$/g, ''));
                                      }}
                                      title="Napsauta kopioidaksesi"
                                    >
                                      <div className="flex justify-between items-center mb-1 text-[9px] font-mono tracking-wider font-bold">
                                        {isDialogue ? (
                                          <span className="text-green-400 flex items-center gap-1">🗣️ PUHE</span>
                                        ) : isPhysical ? (
                                          <span className="text-yellow-600 flex items-center gap-1">🎬 TOIMINTA</span>
                                        ) : (
                                          <span className="text-stone-400">VAIHE {stepId + 1}</span>
                                        )}
                                        <span className="text-stone-600 text-[8px] opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">Kopioi</span>
                                      </div>
                                      <p className={`font-sans leading-relaxed text-sm tracking-wide ${
                                        isDialogue ? "text-white font-bold italic text-[15px]" : "text-stone-300 font-medium"
                                      }`}>
                                        {cleanStep}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ) : log.spoken_prompt ? (
                            <blockquote 
                              className="font-sans text-base md:text-lg font-bold text-white tracking-wide leading-relaxed py-2 pl-3 border-l-2 border-green-500/40 cursor-pointer select-all"
                              onClick={() => {
                                navigator.clipboard.writeText(String(log.spoken_prompt).replace(/^"|"$/g, ''));
                              }}
                              title="Napauta kopioidaksesi"
                            >
                              {log.spoken_prompt}
                            </blockquote>
                          ) : (
                            <p className="text-xs text-stone-500 italic pl-1 leading-relaxed">
                              Ei erityisiä pakollisia vuorosanoja. Toimi vapaasti tilanteen herättämällä tavalla muiden kanssa.
                            </p>
                          )}
                        </div>

                         {/* 4. Postfix: Afterplay / focus posture */}
                        {log.postfix && (
                          <div id="prompt-postfix-field" className="pt-2">
                            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest block mb-1">
                              Toimintaohje odottaessasi seuraavaa vuoroa:
                            </span>
                            <p className="text-xs text-stone-300 font-sans italic bg-stone-900/40 p-2 rounded border border-stone-850/40 leading-relaxed pl-2.5">
                              👉 {log.postfix}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action completion Console */}
                      {!isCompleting ? (
                        <div className="bg-game-card border border-stone-850 rounded-lg p-5 shadow-lg">
                          <form onSubmit={handleActionSubmit} className="space-y-3">
                            {promptError && (
                              <div className="bg-red-500/10 border border-red-500/40 p-3.5 rounded text-xs text-red-300 font-sans flex flex-col gap-2 text-left" id="submission-error-banner">
                                <div className="flex items-center gap-1.5 font-bold text-red-400">
                                  <AlertCircle size={14} className="shrink-0" />
                                  <span>VIRHE LATAUKSESSA</span>
                                </div>
                                <p className="leading-relaxed text-stone-300">{promptError}</p>
                                <button
                                  type="button"
                                  onClick={clearPromptError}
                                  className="text-[10px] font-mono text-stone-500 hover:text-white underline text-left cursor-pointer transition-colors"
                                >
                                  Sulje ilmoitus
                                </button>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <input
                                id="action-outcome"
                                type="text"
                                value={semanticInput}
                                onChange={(e) => setSemanticInput(e.target.value)}
                                placeholder="Huomioita tai kommentteja?"
                                className="w-full bg-stone-900 border border-stone-800 focus:border-green-500/40 rounded py-3 px-4 text-sm text-stone-200 focus:outline-none transition-all font-sans"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-3 px-4 bg-green-500 hover:bg-green-400 text-black rounded font-display font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer glow-primary shadow-lg"
                              id="action-submit-outcome-btn"
                            >
                              Ja sitten... <ArrowRight size={14} />
                            </button>
                          </form>
                        </div>
                      ) : (
                        /* If completing step, display POSTFIX block prominently with compilation loader spinner */
                        <div className="bg-stone-950 border border-green-500/30 p-6 rounded-lg space-y-4 text-center shadow-lg relative overflow-hidden" id="completing-loader-overlay">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500/10 via-green-500 to-green-500/10 animate-pulse"></div>
                          
                          <div className="space-y-1.5">
                            <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest block">Toimintaohje odottaessasi seuraavaa vuoroa:</span>
                            <p className="text-sm font-sans italic text-stone-300 font-semibold max-w-md mx-auto leading-relaxed">
                              "{log.postfix}"
                            </p>
                          </div>

                          <div className="pt-3 border-t border-stone-900 flex justify-center items-center gap-2.5 text-xs font-mono text-stone-400">
                            <span className="h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
                            <span>Pelimoottori kirjoittaa uutta tilannetta...</span>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>
      )}

      {activeTab === "relationships" && (
        <div className="space-y-4 font-sans animate-fade-in" id="relationships-tab-panel">
          <h4 className="font-mono text-xs uppercase tracking-wider text-stone-500 px-1">
            Minun suhteeni ja käsitykseni muihin hahmoihin
          </h4>

          {character.relationships.length === 0 ? (
            <div className="bg-stone-950/40 border border-stone-900 rounded p-4 text-center">
              <p className="text-xs text-stone-500 font-mono">
                Ei heränneitä suhteita vielä tässä skenaariossa. Kun muut pelaajat liittyvät, 
                suhteet hahmojen välillä kehittyvät dynaamisesti.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {character.relationships.map((rel, idx) => (
                <div key={idx} className="bg-game-card border border-stone-850 p-4 rounded-lg flex flex-col gap-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold text-sm flex items-center gap-1">
                      <User size={14} className="text-elopeli-primary" /> {rel.target_character_name}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wide bg-stone-950 px-2 py-0.5 rounded text-stone-400 border border-stone-900">
                      Tila: {rel.current_tension}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 leading-relaxed font-sans mt-1 pl-2 border-l-2 border-elopeli-accent/40">
                    {rel.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "world" && (
        <div className="space-y-4 animate-fade-in text-sans" id="world-tab-panel">
          
          {/* Setting specs */}
          <div className="bg-game-card border border-stone-850 p-4 rounded-lg space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-stone-500 flex items-center gap-1">
              <Map size={12} /> Maailman tila
            </h3>
            <div className="space-y-1.5 text-xs text-stone-400">
              <p><span className="font-mono text-stone-500">Skenaario:</span> <span className="text-white">{game.game_premise}</span></p>
              <p><span className="font-mono text-stone-500">Teema:</span> <span className="text-white uppercase">{game.theme}</span></p>
              <p><span className="font-mono text-stone-500">Ilmapiiri / Tunnelma:</span> <span className="text-white capitalize">{game.mood}</span></p>
              <p><span className="font-mono text-stone-500">Rytmi:</span> <span className="text-stone-300 font-mono">{game.rhythm}</span></p>
            </div>
          </div>

          {/* Plots */}
          <div className="bg-game-card border border-stone-850 p-4 rounded-lg space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-stone-500 flex items-center gap-1">
              <BookOpen size={12} /> Juonikaaret (Plots)
            </h3>
            <div className="space-y-2">
              {game.core_plots.map((plot) => (
                <div key={plot.plot_id} className="bg-stone-950 border border-stone-900 rounded p-2.5 flex items-start gap-2.5">
                  <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${plot.status === "active" ? "bg-green-500 animate-pulse" : "bg-stone-700"}`}></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-stone-300 leading-normal font-sans">
                      {plot.description}
                    </p>
                    <span className="text-[9px] uppercase font-mono text-stone-600 block mt-0.5">
                      {plot.status === "active" ? "Käynnissä" : "Ratkaistu"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Groups list */}
          {game.core_character_groups.length > 0 && (
            <div className="bg-game-card border border-stone-850 p-4 rounded-lg space-y-2">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-stone-500 flex items-center gap-1">
                <Shield size={12} /> Hahmoryhmät (Groups)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {game.core_character_groups.map((grp) => (
                  <div key={grp.group_id} className="bg-stone-950 border border-stone-900 rounded p-2">
                    <span className="text-[11px] font-semibold text-white block truncate">{grp.name}</span>
                    <span className="text-[10px] text-stone-500 leading-normal line-clamp-2 mt-0.5">{grp.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Memory (Recent History Log) shifted here to Tilanne tab */}
          {character.recent_history.length > 0 && (
            <div className="bg-game-card border border-stone-850 p-4 rounded-lg space-y-2 mt-2" id="character-memory-history">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-stone-500 flex items-center gap-1">
                <Clock size={12} /> Hahmon muisti &amp; historia (Viimeisimmät käänteet)
              </h3>
              <div className="space-y-2">
                {character.recent_history.map((hist, index) => (
                  <div key={index} className="bg-stone-950 border border-stone-900 rounded p-3 text-xs leading-relaxed text-stone-400 font-sans">
                    <span className="font-mono text-[10px] text-stone-600 block mb-0.5">Käänne {character.recent_history.length - index}:</span>
                    "{hist}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Room connections list debug */}
          <div className="bg-stone-950 border border-stone-900 p-4 rounded-md text-center">
            <span className="font-mono text-[10px] text-stone-500 uppercase block mb-1">Pariuta toinen puhelin tähän lobbyyn</span>
            <div className="inline-flex items-center gap-1.5 bg-stone-900 rounded px-2.5 py-1 text-sm font-mono font-bold text-white tracking-widest uppercase mb-1">
              {gameId}
            </div>
            <p className="text-[10px] text-stone-500 font-sans leading-relaxed max-w-xs mx-auto">
              Kun muut pelaajat liittävät mobile-selaimensa tähän koodiin, he saavat omat, tilanteeseesi integroidut hahmot.
            </p>
          </div>

          <button
            onClick={onLeaveGame}
            className="w-full py-2 bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded text-xs font-mono transition-colors cursor-pointer"
            id="leave-game-lobby-btn"
          >
            Poistu pelihuoneesta &amp; resetoi session
          </button>
        </div>
      )}

    </div>
  );
}
