/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, Key, Search, RefreshCw, AlertTriangle, Users } from "lucide-react";

interface ActiveLobby {
  game_id: string;
  theme: string;
  mood: string;
  game_premise: string;
  created_at: number;
  player_count: number;
}

interface JoinGameProps {
  onJoin: (gameId: string, playerName: string) => Promise<void>;
  isJoining: boolean;
  error: string | null;
}

export default function JoinGame({ onJoin, isJoining, error }: JoinGameProps) {
  const [gameId, setGameId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [activeLobbies, setActiveLobbies] = useState<ActiveLobby[]>([]);
  const [isLoadingLobbies, setIsLoadingLobbies] = useState(false);

  // Fetch running game rooms on mount or interval
  const fetchActiveLobbies = async () => {
    setIsLoadingLobbies(true);
    try {
      const res = await fetch("/api/games");
      const data = await res.json();
      if (data.success && data.games) {
        setActiveLobbies(data.games);
      }
    } catch (err) {
      console.warn("Failed to fetch running lobbies:", err);
    } finally {
      setIsLoadingLobbies(false);
    }
  };

  useEffect(() => {
    fetchActiveLobbies();
    const interval = setInterval(fetchActiveLobbies, 6000);
    
    // Auto-extract query parameter from QR code scan
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      setGameId(joinCode.toUpperCase());
    }

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameId.trim() && playerName.trim()) {
      onJoin(gameId.trim().toUpperCase(), playerName.trim());
    }
  };

  return (
    <div className="max-w-md mx-auto py-4 px-2" id="join-game-section">
      <div className="text-center mb-6">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-white glow-primary">
          Liity peliin
        </h2>
        <p className="text-stone-400 text-xs mt-1">
          Syötä pelihuoneen koodi ja nimesi hypätäksesi suoraan käynnissä olevaan seikkailuun.
        </p>
      </div>

      <div className="bg-game-card border border-stone-800 rounded-lg p-5 space-y-4 shadow-xl">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-200 text-xs font-mono flex items-start gap-2" id="join-error">
            <AlertTriangle className="shrink-0 text-red-400" size={14} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-mono uppercase text-stone-500" htmlFor="join-room-input">
              Pelihuoneen koodi (PIN)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 text-stone-600" size={16} />
              <input
                id="join-room-input"
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Esim. MATRIX-VOID"
                className="w-full bg-stone-900 border border-stone-800 focus:border-green-500/40 rounded py-2.5 pl-10 pr-4 text-sm text-white font-mono placeholder-stone-600 focus:outline-none transition-all uppercase"
                disabled={isJoining}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-mono uppercase text-stone-500" htmlFor="join-name-input">
              Oma nimesi (näyttelijänä/pelaajana)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-stone-600" size={16} />
              <input
                id="join-name-input"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Esim. Sofia, Pekka, Alex..."
                className="w-full bg-stone-900 border border-stone-800 focus:border-green-500/40 rounded py-2.5 pl-10 pr-4 text-sm text-white font-sans placeholder-stone-600 focus:outline-none transition-all"
                disabled={isJoining}
                maxLength={30}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!gameId.trim() || !playerName.trim() || isJoining}
            className={`w-full py-2.5 px-4 rounded font-display font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              gameId.trim() && playerName.trim() && !isJoining
                ? "bg-green-500 text-black hover:bg-green-400 glow-primary"
                : "bg-stone-900 text-stone-600 border border-stone-850 cursor-not-allowed"
            }`}
            id="join-room-btn"
          >
            {isJoining ? (
              <>
                <span className="h-4 w-4 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
                Varataan character shell...
              </>
            ) : (
              "Yhdistä laite peliin"
            )}
          </button>
        </form>
      </div>

      {/* Active rooms discovery section */}
      <div className="mt-8 space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-mono text-xs uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Users size={12} /> Käynnissä olevat koodit
          </h3>
          <button
            onClick={fetchActiveLobbies}
            className="text-stone-500 hover:text-green-400 p-1 rounded-full transition-colors"
            id="refresh-lobbies-btn"
            title="Päivitä koodit"
          >
            <RefreshCw className={isLoadingLobbies ? "animate-spin text-green-500" : ""} size={12} />
          </button>
        </div>

        {activeLobbies.length === 0 ? (
          <div className="bg-stone-950/40 border border-stone-900 rounded p-4 text-center">
            <p className="text-xs text-stone-600 font-mono">
              Ei aktiivisia pelejä tällä hetkellä. Luo peli ylhäältä aloittaaksesi!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeLobbies.map((lobby) => (
              <button
                key={lobby.game_id}
                onClick={() => {
                  setGameId(lobby.game_id);
                  // Highlight visually or guide scroll
                }}
                className="w-full bg-stone-900/60 border border-stone-850 hover:border-green-500/20 active:bg-stone-900/90 rounded p-3 text-left transition-all flex justify-between items-start gap-4 cursor-pointer"
                id={`room-discover-btn-${lobby.game_id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white bg-stone-800 px-1.5 py-0.5 rounded tracking-wide">
                      {lobby.game_id}
                    </span>
                    <span className="text-[10px] uppercase font-mono text-stone-500">
                      {lobby.mood}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 font-sans mt-1 line-clamp-1">
                    {lobby.theme}: {lobby.game_premise}
                  </p>
                </div>
                <div className="text-[10px] text-green-400/80 font-mono bg-green-500/5 border border-green-500/10 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                  <span className="h-1 text-center font-bold">●</span> {lobby.player_count} hahmoa
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
