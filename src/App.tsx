/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Terminal, Sparkles, User, RefreshCw, AlertCircle, LogOut, ArrowRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import CreateGame from "./components/CreateGame";
import JoinGame from "./components/JoinGame";
import ActiveGame from "./components/ActiveGame";
import Lobby from "./components/Lobby";
import { GameState, Character } from "./types";

// Matrix neutral theme default configurations
const INITIAL_THEME = {
  name: "Matrix Green",
  primary: "#22c55e",
  secondary: "#15803d",
  accent: "#4ad06f",
  bg: "#040b06",
  textColor: "#e1ebe2",
  cardBg: "#0b150d",
  styleClasses: "border border-green-500/20 shadow-lg shadow-green-950/45 rounded-md"
};

// Generates persistent user device session client ID
function getOrCreatePlayerId(): string {
  let pid = localStorage.getItem("elopeli_player_id");
  if (!pid) {
    pid = `usr_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("elopeli_player_id", pid);
  }
  return pid;
}

export default function App() {
  const playerId = getOrCreatePlayerId();
  
  const [page, setPage] = useState<"start" | "lobby" | "game">("start");
  const [gameId, setGameId] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");
  const [game, setGame] = useState<GameState | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Poll active game status regularly when in Lobby or game screen to fetch changes from other players
  useEffect(() => {
    if (!gameId) return;

    const fetchGameStatus = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        const data = await res.json();
        if (data.success && data.game) {
          setGame(data.game);
          
          // If character active state is resolved, dynamically shift pages correctly
          if (characterId) {
            const myChar = data.game.characters[characterId];
            if (myChar && myChar.status === "active" && page === "lobby") {
              setPage("game");
            }
          }
        } else {
          // If server restarted/wiped in-memory states (returning success: false or 404 error)
          console.warn("Huone kadonnut palvelimelta nollauksen takia. Palataan valikkoon.");
          handleLeaveGame();
        }
      } catch (err) {
        console.warn("Telemetry synchronize failed. Still trying:", err);
      }
    };

    fetchGameStatus();
    const interval = setInterval(fetchGameStatus, 3000); // Poll every 3 seconds for multiplayer updates
    return () => clearInterval(interval);
  }, [gameId, characterId, page]);

  // Attempt to restore persistent session on boot (for high usability on mobile interruptions)
  useEffect(() => {
    const cachedGameId = localStorage.getItem("elopeli_cached_game_id");
    const cachedCharId = localStorage.getItem("elopeli_cached_char_id");
    if (cachedGameId) {
      setGameId(cachedGameId);
      if (cachedCharId) {
        setCharacterId(cachedCharId);
        setPage("game");
      } else {
        setPage("lobby");
      }
    }
  }, []);

  const handleCreateGame = async (premise: string, aiModel: string) => {
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_premise: premise, ai_model: aiModel })
      });
      const data = await res.json();
      if (data.success && data.game_id) {
        setGameId(data.game_id);
        setGame(data.game);
        localStorage.setItem("elopeli_cached_game_id", data.game_id);
        setPage("lobby");
      } else {
        setError(data.error || "Scenario activation failed.");
      }
    } catch (err: any) {
      setError("Yhteys palvelimeen epäonnistui. Tarkista, että Ollama on käynnissä ja valittu malli on saatavilla.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGame = async (targetGameId: string, playerName: string) => {
    setIsJoining(true);
    setError(null);
    try {
      // First verify the lobby exists
      const checkRes = await fetch(`/api/games/${targetGameId}`);
      const checkData = await checkRes.json();
      if (!checkData.success) {
        setError(checkData.error || "Room pin code is not valid.");
        setIsJoining(false);
        return;
      }

      setGameId(targetGameId);
      setGame(checkData.game);

      localStorage.setItem("elopeli_player_name", playerName);
      localStorage.setItem("elopeli_cached_game_id", targetGameId);

      // Check if current player already has an active character registered
      const existingChar = Object.values(checkData.game.characters).find(
        (c: any) => c.player_id === playerId
      ) as any;

      if (existingChar) {
        setCharacterId(existingChar.character_id);
        localStorage.setItem("elopeli_cached_char_id", existingChar.character_id);
        setPage("game");
      } else {
        setCharacterId("");
        localStorage.removeItem("elopeli_cached_char_id");
        setPage("lobby");
      }
    } catch (err: any) {
      setError("Cannot link to server room. Try triggering again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleTakeCharacter = async (charId: string, playerName: string) => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/characters/${charId}/take`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          player_name: playerName
        })
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGame(data.game);
        setCharacterId(charId);
        localStorage.setItem("elopeli_cached_char_id", charId);
        setPage("game");
      } else {
        throw new Error(data.error || "Hahmon varaaminen epäonnistui.");
      }
    } catch (err: any) {
      setError(err.message || "Yhteysvirhe hahmon varaamisessa.");
      throw err;
    } finally {
      setIsJoining(false);
    }
  };

  const handleReleaseCharacter = async (charId: string) => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/characters/${charId}/release`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGame(data.game);
        setCharacterId("");
        localStorage.removeItem("elopeli_cached_char_id");
        setPage("lobby");
      } else {
        throw new Error(data.error || "Hahmon vapauttaminen epäonnistui.");
      }
    } catch (err: any) {
      setError(err.message || "Yhteysvirhe hahmon vapauttamisessa.");
      throw err;
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateCustomCharacter = async (playerName: string, customInstruction: string) => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/characters/create-custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: playerId,
          player_name: playerName,
          custom_instruction: customInstruction
        })
      });
      const data = await res.json();
      if (data.success && data.character_id && data.game) {
        setGame(data.game);
        setCharacterId(data.character_id);
        localStorage.setItem("elopeli_cached_char_id", data.character_id);
        setPage("game");
      } else {
        throw new Error(data.error || "Muokatun hahmon luominen epäonnistui.");
      }
    } catch (err: any) {
      setError(err.message || "Yhteysvirhe muokatun hahmon luomisessa.");
      throw err;
    } finally {
      setIsJoining(false);
    }
  };

  const handleCompletePrompt = async (semanticText: string) => {
    if (!gameId || !characterId) return;
    setIsCompleting(true);
    setPromptError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/characters/${characterId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_semantic_input: semanticText })
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGame(data.game);
        setPromptError(null);
      } else {
        setPromptError(data.error || "Pelin kulun päivitys ja uuden vaiheen generointi epäonnistui. Kokeile painaa painiketta uudelleen.");
      }
    } catch (err) {
      console.error("Step prompt completes failed:", err);
      setPromptError("Yhteysvirhe palvelimelle. Tarkista Internet-yhteys ja kokeile painaa painiketta uudelleen.");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleRetryGeneration = async () => {
    if (!gameId || !characterId) return;
    try {
      // Use the general prompt retry endpoint instead of the full character generation retry, which is for setup shell phase!
      // This allows manual retry on normal turns!
      const res = await fetch(`/api/games/${gameId}/characters/${characterId}/retry-prompt`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success && data.game) {
        setGame(data.game);
      }
    } catch (err) {
      console.warn("Retry invocation failed:", err);
    }
  };

  const handleLeaveGame = () => {
    localStorage.removeItem("elopeli_cached_game_id");
    localStorage.removeItem("elopeli_cached_char_id");
    setGameId("");
    setCharacterId("");
    setGame(null);
    setPage("start");
  };

  // Resolve dynamic colors representing the atmospheric setting config
  const activeTheme = game?.themeConfig || INITIAL_THEME;
  const systemCssVars = {
    "--elopeli-bg": activeTheme.bg,
    "--elopeli-card-bg": activeTheme.cardBg,
    "--elopeli-primary": activeTheme.primary,
    "--elopeli-secondary": activeTheme.secondary,
    "--elopeli-accent": activeTheme.accent,
    "--elopeli-text": activeTheme.textColor,
  } as React.CSSProperties;

  const currentCharacter = game ? game.characters[characterId] : null;

  return (
    <div 
      className="min-h-screen bg-game-bg text-elopeli-text transition-colors duration-700 ease-out flex flex-col font-sans relative pb-8 select-none"
      style={systemCssVars}
      id="elopeli-platform-root"
    >
      
      {/* Visual Ambient Blur Accent based on state theme config */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-44 bg-radial from-elopeli-primary/10 to-transparent pointer-events-none blur-3xl z-0"
        style={{ content: "" }}
      ></div>

      {/* Global minimal Header */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 px-4 py-3 flex items-center justify-between z-10 index-10">
        <button 
          onClick={handleLeaveGame}
          className="flex items-center gap-1.5 font-display font-bold uppercase tracking-wider text-sm glow-primary cursor-pointer text-white"
          id="brand-header-link"
        >
          <span className="text-elopeli-primary text-base">🟢</span> Elopeli
        </button>

        {game && (
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs text-stone-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded">
              Huone: <span className="text-white font-bold tracking-wider">{gameId}</span>
            </div>
            
            <button
              onClick={handleLeaveGame}
              className="p-1 px-2 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded font-mono text-[10px] uppercase cursor-pointer"
              id="exit-game-header-btn"
              title="Poistu pelistä"
            >
              Reset
            </button>
          </div>
        )}
      </header>

      {/* Main Container Viewport wrapper */}
      <main className="flex-1 w-full max-w-xl mx-auto px-2 pt-6 relative z-1">
        <AnimatePresence mode="wait">
          
          {page === "start" && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
              id="dashboard-start-screen"
            >
              
              {/* Launcher Splash Card */}
              <div className="bg-game-card/85 p-6 border border-white/5 rounded-lg text-center space-y-3 shadow-xl">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-elopeli-primary animate-pulse">
                  <Terminal size={22} />
                </div>
                
                <h3 className="font-display text-2xl font-semibold tracking-tight text-white uppercase tracking-wide">
                  Sosiaalisen Dramaturgian Simulaatio
                </h3>
                
                <p className="text-stone-400 text-xs leading-relaxed max-w-sm mx-auto">
                  Elopeli on improvisaation ja roolileikin pelimoottori. 
                  Skenaarion ohjaus tapahtuu suorilla näyttelyohjeilla. 
                  <b> Pelaajalla ei ole valintoja </b> - olet käsikirjoitetun 
                  ilmaston armoilla, jossa taidesuunnittelu mukautuu settingin tunnetilaan.
                </p>
              </div>

              {/* Sub tabs (Create game or join game) */}
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-game-card border border-white/5 rounded-lg p-3">
                  <CreateGame 
                    onCreate={handleCreateGame} 
                    isCreating={isCreating} 
                    error={error} 
                  />
                </div>
                
                <div className="bg-game-card border border-white/5 rounded-lg p-3">
                  <JoinGame 
                    onJoin={handleJoinGame} 
                    isJoining={isJoining} 
                    error={error} 
                  />
                </div>
              </div>

            </motion.div>
          )}

          {page === "lobby" && game && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              id="dashboard-lobby-screen"
            >
              <Lobby
                game={game}
                gameId={gameId}
                currentPlayerId={playerId}
                onTakeCharacter={handleTakeCharacter}
                onReleaseCharacter={handleReleaseCharacter}
                onCreateCustomCharacter={handleCreateCustomCharacter}
                onStartPlaying={(charId) => {
                  setPage("game");
                }}
                isJoining={isJoining}
                onLeave={handleLeaveGame}
              />
            </motion.div>
          )}

          {page === "game" && game && currentCharacter && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              id="dashboard-gameplay-screen"
            >
              <ActiveGame
                game={game}
                character={currentCharacter}
                onCompletePrompt={handleCompletePrompt}
                onRetryGeneration={handleRetryGeneration}
                isCompleting={isCompleting}
                gameId={gameId}
                onLeaveGame={handleLeaveGame}
                promptError={promptError}
                clearPromptError={() => setPromptError(null)}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Global atmospheric visual theme indicator in page footer margin */}
      <footer className="mt-auto pt-6 text-center text-[10px] font-mono text-stone-600 space-y-1">
        <p>Aktiivinen Tunnelmateema: <span className="text-elopeli-primary uppercase font-bold tracking-wider">{activeTheme.name}</span></p>
        <p>© 2026 Elopeli Platform. Powered by Ollama{game?.ai_model ? ` / ${game.ai_model}` : ""}.</p>
      </footer>

    </div>
  );
}
