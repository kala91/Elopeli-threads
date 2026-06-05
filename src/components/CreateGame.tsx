/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, Terminal, BookOpen, AlertTriangle, Play } from "lucide-react";
import { motion } from "motion/react";

interface CreateGameProps {
  onCreate: (premise: string, aiModel: string) => Promise<void>;
  isCreating: boolean;
  error: string | null;
}

const PRESETS = [
  {
    title: "Perintöriita (Inheritance Dispute)",
    premise: "Suvun patriarkka on kuollut äkillisesti. Kaikki kertyvät lukemaan testamenttia vanhaan sukukartanoon. Ilmassa on vuosikymmenten kateutta, salaamista ja piiloteltuja sopimuksia.",
    mood: "Painostava & Jännittynyt (Heavy & Tense)",
    color: "from-amber-950 to-stone-900 border-amber-800/35"
  },
  {
    title: "Avaruusaseman kriisi (Space Station Crisis)",
    premise: "Mars-tutkimusaseman happigeneraattori on alkanut vuotaa. Miehistö on suljettu kahteen lohkoon ja pelastuskapseli mahtuu ottamaan kyytiin vain kaksi henkilöä.",
    mood: "Uhanalainen & Rytmikäs (Urgent & Mechanical)",
    color: "from-blue-950 to-slate-900 border-cyan-800/35"
  },
  {
    title: "Romanttinen farssi (Wedding Dinner Catastrophe)",
    premise: "Hääjuhlan loppupuoli hienossa kartanossa. Sulhanen kantoi salaa viestiä morsiamen parhaalta ystävältä ja hääkakun alta löytyi kadonnut kihlasormus väärillä nimillä.",
    mood: "Leikkisä & Absurdi (Playful & Absurd)",
    color: "from-rose-950 to-neutral-900 border-rose-800/35"
  },
  {
    title: "Opettajainhuoneen valtataistelu",
    premise: "Yläkoulun uusi rehtori valitaan huomenna. Kaksi opettajaa kilpailee virasta ja opettajainhuoneen kahvinkeittimen äärellä käydään herpaantumatonta sosiaalista asemasotaa.",
    mood: "Arka & Passiivis-Aggresiivinen (Awkward & Tactical)",
    color: "from-emerald-950 to-zinc-900 border-emerald-800/35"
  }
];

export default function CreateGame({ onCreate, isCreating, error }: CreateGameProps) {
  const [customPremise, setCustomPremise] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const fetchModels = React.useCallback(async () => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.success && Array.isArray(data.models)) {
        setAvailableModels(data.models);
        setSelectedModel((current) => current || data.models[0] || "");
      } else {
        setModelsError(data.error || "Ollama-malleja ei löytynyt.");
      }
    } catch (err) {
      setModelsError("Ollama-mallien skannaus epäonnistui.");
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  React.useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Simulated cycle steps just for gorgeous atmospheric immersion during the generative API call
  React.useEffect(() => {
    if (!isCreating) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, [isCreating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPremise.trim() && selectedModel) {
      onCreate(customPremise, selectedModel);
    }
  };

  const selectPreset = (premise: string) => {
    if (selectedModel) {
      onCreate(premise, selectedModel);
    }
  };

  const loadingMessages = [
    "Muotoillaan semanttista maisemaa...",
    "Generoidaan pelikohtaista dramaturgista sanastoa...",
    "Kartoitetaan pelin ydinjuonia ja hahmoryhmiä...",
    "Rakennettaan tunnetilaan sovitettua visuaalista teemaa...",
    "Aktivoitetaan Elopeli-pelimoottoria..."
  ];

  return (
    <div className="max-w-2xl mx-auto py-4 px-2" id="create-game-section">
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 text-elopeli-primary text-xs tracking-widest font-mono rounded-full mb-3"
        >
          <Terminal size={12} /> ELOPELI SYSTEM v2.0
        </motion.div>
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-white mb-2 glow-primary">
          Aloita uusi peli
        </h1>
        <p className="text-stone-400 text-sm max-w-md mx-auto">
          Määrittele pelattavan skenaarion lähtökohta. Kielimalli luo maailman, 
          juonikaaret sekä tunnetilaan sopeutuvat värikonfiguraatiot.
        </p>
      </div>

      {isCreating ? (
        <div className="bg-game-card/80 border border-green-500/20 rounded-lg p-8 text-center my-6 shadow-xl" id="creation-loader">
          <div className="relative inline-flex items-center justify-center p-6 mb-6">
            <span className="absolute inline-flex h-16 w-16 rounded-full bg-green-500/20 animate-ping"></span>
            <div className="relative h-12 w-12 rounded-full border-2 border-elopeli-primary/40 border-t-elopeli-primary animate-spin"></div>
          </div>
          
          <h3 className="font-mono text-lg text-white mb-2 animate-pulse">
            Ladataan skenaariota...
          </h3>
          
          <div className="max-w-xs mx-auto">
            <p className="font-mono text-xs text-green-400/80 mb-4 h-6 transition-all duration-300">
              ⚡ {loadingMessages[loadingStep]}
            </p>
            <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                className="bg-green-500 h-1.5 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${(loadingStep + 1) * 20}%` }}
                transition={{ duration: 2 }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-4 text-red-200 text-xs font-mono flex items-start gap-2 animate-shake" id="create-error">
              <AlertTriangle className="shrink-0 text-red-400" size={16} />
              <div>
                <span className="font-semibold text-red-300">Moottorivirhe:</span> {error}
              </div>
            </div>
          )}

          {/* Quick presets list */}
          <div className="space-y-4">
            <div className="bg-stone-950/60 border border-stone-850 rounded p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-mono uppercase text-stone-400" htmlFor="model-select">
                  Valitse kielimalli
                </label>
                <button
                  type="button"
                  onClick={fetchModels}
                  className="text-[10px] font-mono text-stone-500 hover:text-green-400 transition-colors"
                  disabled={isLoadingModels}
                >
                  {isLoadingModels ? "Skannataan..." : "Päivitä lista"}
                </button>
              </div>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-stone-900 border border-stone-800 focus:border-green-500/40 rounded py-2.5 px-3 text-sm text-white font-mono focus:outline-none transition-all"
                disabled={isLoadingModels || availableModels.length === 0}
              >
                {availableModels.length === 0 ? (
                  <option value="">Ei Ollama-malleja saatavilla</option>
                ) : (
                  availableModels.map((model) => (
                    <option value={model} key={model}>
                      {model}
                    </option>
                  ))
                )}
              </select>
              {modelsError && (
                <p className="text-[11px] text-red-300 font-mono">
                  {modelsError}
                </p>
              )}
            </div>

            <h3 className="font-mono text-xs tracking-wider uppercase text-stone-400 flex items-center gap-2">
              <BookOpen size={14} /> Valitse valmis skenaario
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => selectPreset(p.premise)}
                  disabled={!selectedModel}
                  className={`text-left p-4 rounded bg-gradient-to-br ${p.color} hover:brightness-125 transition-all border flex flex-col justify-between h-40 group ${selectedModel ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                  id={`preset-btn-${idx}`}
                >
                  <div>
                    <h4 className="font-display font-semibold text-white group-hover:text-elopeli-primary transition-colors text-sm">
                      {p.title}
                    </h4>
                    <p className="text-stone-400 text-xs mt-2 line-clamp-3">
                      {p.premise}
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-green-400/80 bg-black/40 px-2 py-0.5 rounded self-start mt-2">
                    {p.mood}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-stone-800"></div>
            <span className="flex-shrink mx-4 text-stone-600 font-mono text-xs">TAI KIRJOITA OMA</span>
            <div className="flex-grow border-t border-stone-800"></div>
          </div>

          {/* Custom premise form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase text-stone-400" htmlFor="premise-input">
                Luo oma skenaario
              </label>
              <textarea
                id="premise-input"
                value={customPremise}
                onChange={(e) => setCustomPremise(e.target.value)}
                placeholder="Esim. 'Laivaajakartanon salaperäinen illallinen, jossa rikas suku kokoontuu. Isäntä paljastaa heti kättelyssä jättävänsä omaisuutensa kissalleen, mutta kesken illallisen valot sammuvat...'"
                className="w-full h-28 bg-stone-900 border border-stone-800 focus:border-green-500/40 rounded p-3 text-sm text-stone-200 placeholder-stone-600 font-sans focus:outline-none transition-all resize-none"
                maxLength={500}
              />
              <span className="text-[10px] text-stone-600 flex justify-end font-mono">
                {customPremise.length}/500 merkkiä
              </span>
            </div>

            <button
              type="submit"
              disabled={!customPremise.trim() || !selectedModel || isCreating}
              className={`w-full py-3 px-4 rounded font-display font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                customPremise.trim() && selectedModel
                  ? "bg-green-500 text-black hover:bg-green-400 glow-primary"
                  : "bg-stone-900 text-stone-600 border border-stone-850 cursor-not-allowed"
              }`}
              id="boot-preset-btn"
            >
              <Sparkles size={16} /> Aktivoi uusi maailma
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
