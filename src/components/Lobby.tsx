/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Users, Play, Copy, ArrowRight, Shield, Command, MapPin, Sparkles, HelpCircle, QrCode, LogOut, UserCheck } from "lucide-react";
import { GameState, Character } from "../types";

interface LobbyProps {
  game: GameState;
  gameId: string;
  currentPlayerId: string;
  onTakeCharacter: (characterId: string, playerName: string) => Promise<void>;
  onReleaseCharacter: (characterId: string) => Promise<void>;
  onCreateCustomCharacter: (playerName: string, customInstruction: string) => Promise<void>;
  onStartPlaying: (characterId: string) => void;
  isJoining: boolean;
  onLeave: () => void;
}

export default function Lobby({
  game,
  gameId,
  currentPlayerId,
  onTakeCharacter,
  onReleaseCharacter,
  onCreateCustomCharacter,
  onStartPlaying,
  isJoining,
  onLeave
}: LobbyProps) {
  const [typedName, setTypedName] = React.useState(() => {
    return localStorage.getItem("elopeli_player_name") || "";
  });
  const [nameSubmitted, setNameSubmitted] = React.useState(() => {
    return !!localStorage.getItem("elopeli_player_name");
  });
  const [customDescription, setCustomDescription] = React.useState("");
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  // Check if current player already has a character registered in the room
  const registeredChar = Object.values(game.characters).find(
    (c) => c.player_id === currentPlayerId
  );

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedName.trim()) {
      localStorage.setItem("elopeli_player_name", typedName.trim());
      setNameSubmitted(true);
    }
  };

  const handleClearName = () => {
    localStorage.removeItem("elopeli_player_name");
    setNameSubmitted(false);
  };

  const selectPremade = async (characterId: string) => {
    if (!typedName) return;
    setStatusMsg("Varataan hahmoa...");
    try {
      await onTakeCharacter(characterId, typedName);
      setStatusMsg(null);
    } catch (err: any) {
      setStatusMsg(err.message || "Hahmon varaaminen epäoronnistui.");
    }
  };

  const releaseMyCharacter = async (characterId: string) => {
    setStatusMsg("Vapautetaan hahmoa takaisin...");
    try {
      await onReleaseCharacter(characterId);
      setStatusMsg(null);
    } catch (err: any) {
      setStatusMsg("Vapauttaminen epäonnistui.");
    }
  };

  const buildCustom = async () => {
    if (!typedName) return;
    setStatusMsg("Luodaan uutta hahmoasi AI-avustajalla...");
    try {
      await onCreateCustomCharacter(typedName, customDescription.trim());
      setStatusMsg(null);
      setCustomDescription("");
    } catch (err: any) {
      setStatusMsg("Räätälöinti epäonnistui.");
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameId);
  };

  const allCharacters = Object.values(game.characters);
  
  // Separate into available premade ones, and taken ones
  const availablePremades = allCharacters.filter(c => c.status === "premade" && !c.player_id);
  const takenCharacters = allCharacters.filter(c => c.player_id !== null);

  // Construct join URL
  const joinUrl = `${window.location.origin}/?join=${gameId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=22c55e&bgcolor=0c0c0c&qzone=2&data=${encodeURIComponent(joinUrl)}`;

  // FIRST STEP: Require player name
  if (!nameSubmitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6" id="name-registration-view">
        <div className="text-center space-y-2">
          <h2 className="font-display text-3xl font-extrabold uppercase text-white tracking-wider glow-primary">
            LIITY BÄNDIIN
          </h2>
          <p className="text-xs text-stone-400 font-sans">
            Määritä oma oikea nimesi (tai kutsumanimesi), jotta muut pelaajat tunnistavat kuka olet.
          </p>
        </div>

        <div className="bg-game-card border border-stone-850 p-6 rounded-lg shadow-xl space-y-4">
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1">
                Pelaajan Nimi:
              </label>
              <input
                type="text"
                required
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Esim. Pekka, Johanna, Markus..."
                className="w-full bg-stone-950 border border-stone-800 focus:border-green-500/40 rounded py-2.5 px-3 text-sm text-white placeholder-stone-600 focus:outline-none"
                maxLength={20}
              />
            </div>

            <button
              type="submit"
              disabled={!typedName.trim()}
              className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black font-display font-bold text-xs tracking-wider uppercase cursor-pointer rounded shadow-lg transition-all flex items-center justify-center gap-1.5 glow-primary"
            >
              Jatka Skenaarioon <ArrowRight size={13} />
            </button>
          </form>
        </div>

        <div className="text-center">
          <button
            onClick={onLeave}
            className="text-stone-500 hover:text-stone-300 font-mono text-xs cursor-pointer"
          >
            ← Peruuta ja palaa valikkoon
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6" id="game-lobby-dashboard">
      
      {/* Header Lobby Info */}
      <div className="text-center space-y-2">
        <h2 className="font-display text-4xl font-black uppercase text-white tracking-widest glow-primary">
          ELOPELI LOBBY
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 bg-stone-900/80 border border-stone-850 px-4 py-1.5 rounded-full shadow-md">
            <span className="text-[10px] font-mono uppercase text-stone-500">LIITTYMISKOODI:</span>
            <span 
              onClick={() => setShowQrModal(true)}
              className="font-mono text-sm font-bold text-green-400 tracking-wider uppercase cursor-pointer hover:text-green-300 transition-colors"
              title="Näytä QR-koodi"
            >
              {gameId}
            </span>
            <div className="flex items-center gap-1 border-l border-stone-800 pl-1.5 ml-1">
              <button 
                onClick={copyRoomCode}
                className="p-1 text-stone-500 hover:text-green-400 rounded transition-colors cursor-pointer"
                title="Kopioi koodi"
              >
                <Copy size={11} />
              </button>
              <button 
                onClick={() => setShowQrModal(true)}
                className="p-1 text-stone-400 hover:text-green-400 rounded transition-colors cursor-pointer"
                title="Näytä QR-koodi"
              >
                <QrCode size={12} className="text-green-500" />
              </button>
            </div>
          </div>

          <div className="text-xs text-stone-400 font-sans flex items-center gap-1">
            <span>Pelaaja: <b>{typedName}</b></span>
            <button 
              onClick={handleClearName} 
              className="text-stone-600 hover:text-rose-400 font-mono text-[10px] underline ml-1"
              title="Vaihda käyttämänimesi"
            >
              (vaihda)
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal Dialog */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-950 border border-stone-850 max-w-sm w-full rounded-lg p-6 space-y-4 text-center relative shadow-2xl">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-wider">
              Skannaa ja liity peliin
            </h3>
            <p className="text-xs text-stone-400 font-sans">
              Muiden laitteiden kamera otetaan esiin ja osoitetaan tähän koodiin liittymistä varten!
            </p>
            
            <div className="bg-stone-900 p-4 rounded-md inline-block border border-stone-800/80">
              <img 
                src={qrImageUrl} 
                alt={`QR-koodi ${gameId}`}
                className="w-48 h-48 mx-auto rounded"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="text-xs font-mono bg-stone-900 p-2.5 rounded border border-stone-850 text-stone-300 break-all select-all">
              {joinUrl}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-2 bg-green-500 hover:bg-green-400 text-black font-display font-semibold rounded text-xs transition-colors cursor-pointer"
              >
                Sulje ikkuna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setting Specs Banner at the very top of user flow */}
      <div className="bg-game-card border border-stone-850 p-5 rounded-lg space-y-3 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none rounded-full blur-2xl"></div>
        
        <div>
          <span className="text-[10px] font-mono text-stone-500 uppercase block tracking-wider font-semibold">Tämän pelin skenaario & tilanne:</span>
          <h3 className="font-display font-black text-2xl text-white mt-1 uppercase tracking-wide">
            {game.theme}
          </h3>
          <p className="text-xs sm:text-sm text-stone-300 font-serif leading-relaxed italic mt-2">
            "{game.game_premise}"
          </p>
        </div>

        <div className="pt-3 border-t border-stone-900 grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="text-stone-500 text-[9px] uppercase block tracking-wider">Mielentila (Mood):</span>
            <span className="text-white capitalize font-semibold flex items-center gap-1">
              <Sparkles size={11} className="text-green-500" /> {game.mood}
            </span>
          </div>
          <div>
            <span className="text-stone-500 text-[9px] uppercase block tracking-wider">Pelikierroksen syke:</span>
            <span className="text-stone-300 font-mono block">{game.rhythm}</span>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-2.5 rounded text-xs font-mono text-center animate-pulse">
          {statusMsg}
        </div>
      )}

      {/* RENDER ACTIVE GAME SESSION CONTROLS IF ALREADY CHOSEN A CHARACTER */}
      {registeredChar ? (
        <div className="bg-stone-950 border-2 border-green-500 p-5 rounded-lg space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <UserCheck className="text-green-500" size={18} />
            <span className="text-xs font-mono uppercase text-green-400 font-bold tracking-wider">
              Sinun hahmosi on valmis ja varattu!
            </span>
          </div>

          <div className="bg-game-card p-4 rounded border border-stone-850 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-display font-bold text-lg text-white">
                  {registeredChar.name}
                </h4>
                <p className="text-xs text-stone-400 font-semibold uppercase font-mono mt-0.5">
                  Rooli: {registeredChar.role}
                </p>
              </div>
              <span className="bg-green-500 text-black text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full font-bold">
                Oma roolisi
              </span>
            </div>
            
            <p className="text-xs text-stone-300 font-sans leading-relaxed pt-1.5 border-t border-stone-900">
              <b>Taustakuvaus:</b> {registeredChar.description}
            </p>
            
            <div className="mt-2 pt-2 border-t border-stone-900 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-stone-950 rounded border border-stone-900">
                <span className="text-stone-500 text-[9px] font-mono uppercase block">Salainen Tavoite (Goal):</span>
                <span className="text-stone-200 font-medium">{registeredChar.goal}</span>
              </div>
              <div className="p-2 bg-stone-950 rounded border border-stone-900">
                <span className="text-stone-500 text-[9px] font-mono uppercase block">Salaisuus / Ankkuri:</span>
                <span className="text-stone-200 font-medium">{registeredChar.dramaturgical_anchor}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onStartPlaying(registeredChar.character_id)}
              className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-display font-black text-sm uppercase tracking-widest cursor-pointer rounded shadow-lg transition-all flex items-center justify-center gap-2 glow-primary"
            >
              Mene Peliin / Aloita Vuoro <Play size={14} fill="currentColor" />
            </button>
            <button
              onClick={() => releaseMyCharacter(registeredChar.character_id)}
              className="py-3 px-4 bg-stone-900 hover:bg-rose-950 hover:text-rose-400 border border-stone-800 hover:border-rose-900 text-stone-400 rounded text-xs font-mono transition-colors cursor-pointer flex items-center gap-1"
              title="Vapauta tämä hahmo ja valitse toinen"
            >
              <LogOut size={13} /> Vapauta
            </button>
          </div>
        </div>
      ) : (
        /* RENDER CHOOSE / CREATE CHARACTER OPTIONS */
        <div className="space-y-6" id="character-selection-draft-flow">
          
          {/* A. PRE-MADE CHARACTERS LIST */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-stone-100 text-sm uppercase tracking-wider flex items-center gap-1.5 px-0.5">
              <Users size={16} className="text-green-500" /> 1. Valitse valmis hahmo skenaariosta
            </h3>

            {availablePremades.length === 0 ? (
              <div className="p-4 bg-stone-900/30 border border-stone-850 rounded text-center">
                <p className="text-xs text-stone-500 font-sans">
                  Kaikki skenaarion valmiit hahmot on jo varattu muille pelaajille.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availablePremades.map((pc) => (
                  <div
                    key={pc.character_id}
                    className="bg-game-card border border-stone-850 rounded-lg p-4 flex flex-col justify-between hover:border-green-500/30 transition-all shadow-md group relative overflow-hidden"
                  >
                    <div className="space-y-2">
                      <div>
                        <h4 className="font-display font-bold text-white text-base group-hover:text-green-400 transition-colors">
                          {pc.name}
                        </h4>
                        <p className="text-xs text-green-500/90 font-mono font-medium lowercase">
                          {pc.role}
                        </p>
                      </div>
                      <p className="text-xs text-stone-300 font-sans leading-relaxed line-clamp-3">
                        {pc.description}
                      </p>
                      
                      <div className="pt-2 border-t border-stone-900/60 space-y-1 text-[11px]">
                        <div>
                          <span className="text-stone-500 font-mono text-[9px] uppercase">Haave / Tavoite:</span>
                          <p className="text-stone-300 font-sans italic">"{pc.goal}"</p>
                        </div>
                        <div>
                          <span className="text-stone-500 font-mono text-[9px] uppercase">Kiinnike / Salaisuus:</span>
                          <p className="text-stone-300 font-sans text-xs">{pc.dramaturgical_anchor}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => selectPremade(pc.character_id)}
                      disabled={isJoining}
                      className="w-full mt-4 py-2 bg-stone-900 hover:bg-green-500 text-stone-300 hover:text-black font-display font-bold text-xs uppercase cursor-pointer rounded transition-all flex items-center justify-center gap-1 border border-stone-800 hover:border-green-500"
                    >
                      Valitse ja Aloita <ArrowRight size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B. GENERATE ORIGINAL CUSTOMIZED CHARACTER */}
          <div className="bg-stone-950 p-5 rounded-lg border border-stone-850 space-y-3 shadow-lg">
            <h3 className="font-display font-bold text-white text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={16} className="text-green-500 animate-pulse" /> 2. Tai kuvaile ja luo oma hahmo
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed font-sans">
              Haluatko mieluummin aivan omanlaisesta kulmasta osaksi tätä tarinaa? Kirjoita alle 
              lyhyesti mitä haluat esittää tai mistä nautit. Generatiivinen tekoäly luo hahmon juuri tähän sopivaksi.
            </p>

            <div className="space-y-3 pt-1">
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Esim. 'Haluaisin olla salaperäinen lääkäri jolla on taskussaan outoa myrkkyä', tai 'Petollinen serkkupoika, joka tietää liikaa...' jne. Voit jättää myös tyhjäksi täysin yllättävää roolia varten!"
                className="w-full h-20 bg-stone-900 border border-stone-800/80 focus:border-green-500/40 rounded p-2.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-0 leading-relaxed resize-none"
                maxLength={200}
                disabled={isJoining}
              />
              
              <button
                onClick={buildCustom}
                disabled={isJoining}
                className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black font-display font-bold text-xs tracking-wider uppercase cursor-pointer rounded transition-all flex items-center justify-center gap-1.5 glow-secondary"
              >
                Räätälöi ja Generoi Hahmoni <Sparkles size={12} fill="currentColor" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Taken Characters overview */}
      {takenCharacters.length > 0 && (
        <div className="bg-stone-950/40 border border-stone-900 rounded-lg p-4 space-y-2">
          <h4 className="text-stone-500 font-mono text-[10px] uppercase font-bold tracking-wider">
            Muut pelaajat ja varatut roolit:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {takenCharacters.map(tc => (
              <div key={tc.character_id} className="p-2 bg-stone-900/30 border border-stone-850/60 rounded flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">{tc.name}</span>
                  <span className="text-stone-400 text-[10px] font-mono block">{tc.role}</span>
                </div>
                <span className="text-[9px] font-mono text-stone-600">Pelaaja: {tc.player_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules remainder walkthrough popup */}
      <div className="bg-stone-950/20 p-4 border border-stone-900 rounded text-stone-500 text-xs space-y-1.5 font-sans leading-relaxed">
        <span className="font-mono text-[10px] text-stone-400 font-semibold block flex items-center gap-1 uppercase">
          <HelpCircle size={10} /> Miten tätä pelataan? (Rules of the Game)
        </span>
        <ol className="list-decimal pl-4 space-y-1 text-stone-500 text-[11px]">
          <li>Skenaarion isäntä luo pelin ja muut liittyvät koodilla omilla puhelimillaan.</li>
          <li>Kukin valitsee valmiin hahmon tai kuvailee oman roolinsa ja saa taustatarinan ja salaiset tavoitteet.</li>
          <li>Peli ohjaa sinua suorilla repliikeillä, joita sinun tulee esittää ja puhua ääneen samassa huoneessa oleville ihmisille.</li>
          <li>Kun olet lausunut repliikkisi, kirjoita lyhyt kuvaus ja pyydä uusi tilanneprompti.</li>
        </ol>
      </div>

      <div className="pt-2 flex justify-between items-center text-xs">
        <button
          onClick={onLeave}
          className="text-stone-500 hover:text-stone-300 font-mono cursor-pointer"
        >
          ← Takaisin valikkoon
        </button>
      </div>

    </div>
  );
}
