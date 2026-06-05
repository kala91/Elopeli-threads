/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

const Type = {
  OBJECT: "object",
  STRING: "string",
  ARRAY: "array"
} as const;

// In-memory data store for Elopeli games
// gameId -> GameState
const games: Record<string, any> = {};

// Helper to generate clean unique room pins (e.g. CRIMSON-STORM, COLD-STEEL)
function generateRoomCode(): string {
  const words = [
    "NEUTRAL", "MATRIX", "STEEL", "CRIMSON", "GOLD", "VOID", "CYAN", "MINT", 
    "COZY", "BLOOD", "WIND", "STORM", "MIST", "OAK", "BEIGE", "SILVER", 
    "OFFICE", "FARCE", "RITUAL", "DREAD", "EMERALD", "AUTUMN", "DUSK", "DAWN"
  ];
  const select = () => words[Math.floor(Math.random() * words.length)];
  return `${select()}-${select()}`;
}

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
}

function appendJsonContract(prompt: string, schema: any): string {
  return `${prompt}

Return only valid JSON. Do not use markdown fences, prose, comments, or trailing commas.
The JSON must match this schema description:
${JSON.stringify(schema, null, 2)}`;
}

function extractJsonObject(rawText: string): string {
  const text = rawText.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Ollama response did not contain a JSON object.");
  }
  return text.slice(first, last + 1);
}

async function listOllamaModels(): Promise<string[]> {
  const response = await fetch(`${getOllamaBaseUrl()}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama model scan failed (${response.status}). Is Ollama running at ${getOllamaBaseUrl()}?`);
  }
  const data = await response.json() as { models?: Array<{ name?: string }> };
  return (data.models || [])
    .map((model) => model.name)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
}

async function generateOllamaJson<T>({
  model,
  prompt,
  schema,
  temperature
}: {
  model: string;
  prompt: string;
  schema: any;
  temperature: number;
}): Promise<T> {
  const response = await fetch(`${getOllamaBaseUrl()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: appendJsonContract(prompt, schema),
      stream: false,
      format: "json",
      options: { temperature }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama generation failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as { response?: string };
  if (!data.response) {
    throw new Error("Ollama returned an empty generation response.");
  }
  return JSON.parse(extractJsonObject(data.response)) as T;
}

// API endpoint to fetch list of existing games for debug / joining
app.get("/api/games", (req, res) => {
  const list = Object.values(games).map((g) => ({
    game_id: g.game_id,
    theme: g.theme,
    mood: g.mood,
    ai_model: g.ai_model,
    game_premise: g.game_premise,
    created_at: g.created_at,
    player_count: Object.keys(g.characters).length,
  }));
  res.json({ success: true, games: list });
});

// API endpoint to scan locally available Ollama models for the client selector
app.get("/api/models", async (req, res) => {
  try {
    const models = await listOllamaModels();
    res.json({ success: true, models, base_url: getOllamaBaseUrl() });
  } catch (error: any) {
    res.status(502).json({ success: false, models: [], error: error.message || "Ollama model scan failed." });
  }
});

// API endpoint to create a new Elopeli game from a custom premise
app.post("/api/games", async (req, res) => {
  const { game_premise, ai_model } = req.body;
  if (!game_premise || game_premise.trim() === "") {
    return res.status(400).json({ success: false, error: "Please enter a game scenario premise." });
  }
  if (!ai_model || ai_model.trim() === "") {
    return res.status(400).json({ success: false, error: "Valitse paikallinen Ollama-kielimalli ennen pelin luontia." });
  }

  try {
    const worldPrompt = `
      You are the ontological engine of Elopeli, an interactive atmospheric improvisation game platform.
      The player has provided the following premise: "${game_premise}"

      Generate the game parameters according to the Elopeli architecture. Create a cohesive conceptual setting.

      Crucially, design a "themeConfig" with a customized visual palette that matches the emotional tone of the setting. Choose colors carefully to create a beautiful, immersive, high-contrast, eye-safe theme. Do not provide neon matrix colors if the tone is a cozy romance, pastel office, or dramatic historical tragedy.
      For styling, visual vibe must match the setting: e.g.,
      - Warm cafe: brown/beige/dark gray colors, soft rounded corners.
      - Cold space crisis: dark slate/electric cyan/neon orange accents, sharp corners, technological border styling.
      - Heartbroken romance: soft dusty rose/dark charcoal/white, minimalist outlines.
      - Corporate power thriller: navy blue/office steel gray/gold, medium shadows.

      Along with this, write exactly 4 distinct and highly atmospheric pre-made character templates (in "premade_characters") that players can immediately select and step into in this scenario. These characters must have deep goals, anchors, and roles matching the theme.

      Return the result in JSON format matching the schema rules.
    `;

    // Define response schema to prevent hallucinated structures
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        theme: { type: Type.STRING, description: "Descriptive Finland-style or English narrative theme name, e.g. 'perintöriita', 'avaruusaseman kriisi', 'opettajainhuoneen valtataistelu'" },
        mood: { type: Type.STRING, description: "Main emotional tone, e.g., painostava, leikkisä, melankolinen, kiihkeä, rituaalinen, absurdi, arka, juhlava, uhkaava, haikea" },
        rhythm: { type: Type.STRING, description: "Dramaturgical tempo/pacing, e.g., 'hitaasti tihentyvä', 'nopeasti eskaloituva', 'kohtauksittain purkautuva'" },
        core_plots: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              plot_id: { type: Type.STRING, description: "Brief unique ID, e.g. plot_will, plot_escape" },
              description: { type: Type.STRING, description: "Vivid description of this line, e.g. 'Kuka saa haltuunsa suvun testamentin?'" },
            },
            required: ["plot_id", "description"]
          }
        },
        core_character_groups: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              group_id: { type: Type.STRING },
              name: { type: Type.STRING, description: "Group name, e.g., 'suvun vanha haara', 'palvelusväki'" },
              description: { type: Type.STRING, description: "Brief description of the group's motives" }
            },
            required: ["group_id", "name", "description"]
          }
        },
        dramaturgical_vocabulary: {
          type: Type.OBJECT,
          properties: {
            social_structures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING, description: "e.g. selvittävä, salaava, haastava, sovitteleva" },
                  description: { type: Type.STRING, description: "Brief meaning" }
                },
                required: ["keyword", "description"]
              }
            },
            mechanical_structures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING, description: "e.g. dialogi, katse, kuiskaus, esineen antaminen, tauko" },
                  description: { type: Type.STRING, description: "The physical or verbal form of play" }
                },
                required: ["keyword", "description"]
              }
            },
            target_types: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING, description: "e.g. toinen hahmo, hahmo itse, ryhmä, esine, salaisuus, muisto" },
                  description: { type: Type.STRING }
                },
                required: ["keyword", "description"]
              }
            }
          },
          required: ["social_structures", "mechanical_structures", "target_types"]
        },
        themeConfig: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Cool thematic name, e.g. 'Cosmic Slate', 'Dusty Rose Romance'" },
            primary: { type: Type.STRING, description: "Hex primary color" },
            secondary: { type: Type.STRING, description: "Hex secondary matching tone color" },
            accent: { type: Type.STRING, description: "Hex vibrant highlight color" },
            bg: { type: Type.STRING, description: "Hex very dark background (almost black eye-safe vibe)" },
            textColor: { type: Type.STRING, description: "Hex light text color" },
            cardBg: { type: Type.STRING, description: "Hex slightly lighter container background" },
            styleClasses: { type: Type.STRING, description: "Space delimited tailwind styling overrides for borders or shadow effects, e.g. 'border-l-4 border-rose-500 rounded-none shadow-xl shadow-rose-950/20'" }
          },
          required: ["name", "primary", "secondary", "accent", "bg", "textColor", "cardBg", "styleClasses"]
        },
        premade_characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Finland-style or setting-style name (e.g. 'Kaarle', 'Helena', 'Z-401')" },
              role: { type: Type.STRING, description: "Their role, e.g. 'suvun hyljeksimä kuopus'" },
              goal: { type: Type.STRING, description: "Personal driving goal/tavoite, e.g. 'Selvitä testamentin olinpaikka.'" },
              dramaturgical_anchor: { type: Type.STRING, description: "Their dramaturgical anchor (secret, item, debt, trauma), e.g. 'Kantaa taskussaan vanhaa rikkirevittyä sopimusta.'" },
              description: { type: Type.STRING, description: "Vivid personal acting guide." },
              current_dramaturgical_intention: { type: Type.STRING, description: "First narrative stance motive guide." }
            },
            required: ["name", "role", "goal", "dramaturgical_anchor", "description", "current_dramaturgical_intention"]
          }
        }
      },
      required: [
        "theme", "mood", "rhythm", "core_plots", "core_character_groups", 
        "dramaturgical_vocabulary", "themeConfig", "premade_characters"
      ]
    };

    const worldData = await generateOllamaJson<any>({
      model: ai_model,
      prompt: worldPrompt,
      schema: responseSchema,
      temperature: 0.85
    });
    const gameId = generateRoomCode();

    // Map the resolved items from array formats for the game state object
    games[gameId] = {
      game_id: gameId,
      ai_model,
      created_at: Date.now(),
      game_premise: game_premise,
      theme: worldData.theme || "Elopeli",
      mood: worldData.mood || "Neutral green",
      rhythm: worldData.rhythm || "Default rhythm",
      core_plots: (worldData.core_plots || []).map((p: any) => ({ ...p, status: "active" })),
      core_character_groups: worldData.core_character_groups || [],
      dramaturgical_vocabulary: worldData.dramaturgical_vocabulary || {
        social_structures: [],
        mechanical_structures: [],
        target_types: []
      },
      themeConfig: worldData.themeConfig || {
        name: "Matrix Green",
        primary: "#22c55e",
        secondary: "#15803d",
        accent: "#16a34a",
        bg: "#020617",
        textColor: "#f8fafc",
        cardBg: "#0f172a",
        styleClasses: "border-l-4 border-green-500 rounded-lg shadow-xl"
      },
      characters: {}
    };

    // Instantiate generated pre-made characters ready to be adopted
    const premades = worldData.premade_characters || [];
    premades.forEach((pc: any, idx: number) => {
      const char_id = `char_pre_${Math.random().toString(36).substring(2, 8)}_${idx}`;
      games[gameId].characters[char_id] = {
        character_id: char_id,
        player_id: null,
        player_name: null,
        status: "premade",
        name: pc.name,
        role: pc.role,
        goal: pc.goal,
        goal_status: "active",
        goal_history: [],
        dramaturgical_anchor: pc.dramaturgical_anchor,
        description: pc.description,
        current_dramaturgical_intention: pc.current_dramaturgical_intention || "Sopeutuminen tilanteeseen.",
        recent_history: [],
        relationships: [],
        current_prompt: null
      };
    });

    // Generate connections between pre-made characters so they are fully populated in advance
    const premadeCharsList = Object.values(games[gameId].characters);
    premadeCharsList.forEach((c1: any, idx1: number) => {
      premadeCharsList.forEach((c2: any, idx2: number) => {
        if (idx1 !== idx2) {
          c1.relationships.push({
            target_character_id: c2.character_id,
            target_character_name: c2.name,
            description: `Mukanatoimija tässä tilanteessa. Rooli: ${c2.role}.`,
            current_tension: "secretive"
          });
        }
      });
    });

    // Fire background prompt generation for each premade character beforehand so it is instant
    premadeCharsList.forEach((c: any) => {
      triggerPromptGeneration(gameId, c.character_id).catch((err) => {
        console.warn(`Failed background pre-prompt trigger for ${c.character_id}:`, err);
      });
    });

    res.json({ success: true, game_id: gameId, game: games[gameId] });
  } catch (error: any) {
    console.error("Error creating Elopeli Game:", error);
    res.status(500).json({ success: false, error: error.message || "An unexpected engine error occurred." });
  }
});

// GET game status details
app.get("/api/games/:gameId", (req, res) => {
  const { gameId } = req.params;
  const game = games[gameId];
  if (!game) {
    return res.status(404).json({ success: false, error: "Game session room not found. Double check the code." });
  }
  res.json({ success: true, game });
});

// POST to join a game (instantly creates character shell, or handles custom instructions if provided)
app.post("/api/games/:gameId/join", async (req, res) => {
  const { gameId } = req.params;
  const { player_name, player_id, custom_instruction } = req.body;

  const game = games[gameId];
  if (!game) {
    return res.status(404).json({ success: false, error: "Game code was not found." });
  }
  if (!player_name || player_name.trim() === "") {
    return res.status(400).json({ success: false, error: "Please enter your real name to join the game." });
  }
  if (!player_id) {
    return res.status(400).json({ success: false, error: "Internal error: Missing player_id identifier." });
  }

  // Create character ID
  const character_id = `char_${Math.random().toString(36).substring(2, 9)}`;

  // Create a Character Shell first as defined in Elopeli specification
  const shellCharacter = {
    character_id,
    player_id,
    player_name,
    status: "shell" as const,
    name: "Placeholder Shell",
    role: "Calculating character...",
    goal: "Preparing starting objective...",
    goal_status: "active" as const,
    goal_history: [],
    dramaturgical_anchor: "Awaiting generation...",
    description: "Initializing core background, matching other players...",
    current_dramaturgical_intention: "Initializing...",
    recent_history: [],
    relationships: [],
    current_prompt: null
  };

  // Add shell to game characters so player instantly registers in UI
  game.characters[character_id] = shellCharacter;

  // Fire background generator for the complete custom character mapping
  generateFullCharacter(gameId, character_id, custom_instruction).catch((err) => {
    console.error(`Failed to generate character for ${character_id}:`, err);
    // If generation fails, safely fallback or leave as error
    if (game.characters[character_id]) {
      game.characters[character_id].role = "Error: Click retry to reinitialize character generation.";
    }
  });

  res.json({ 
    success: true, 
    character_id, 
    character: shellCharacter,
    game
  });
});

// POST to take or adopt a pre-made character
app.post("/api/games/:gameId/characters/:characterId/take", async (req, res) => {
  const { gameId, characterId } = req.params;
  const { player_id, player_name } = req.body;

  const game = games[gameId];
  if (!game) return res.status(404).json({ success: false, error: "Game room not found." });
  const char = game.characters[characterId];
  if (!char) return res.status(404).json({ success: false, error: "Character not found." });

  if (char.player_id && char.player_id !== player_id) {
    return res.status(400).json({ success: false, error: "Hahmo on jo toisen pelaajan varaama." });
  }

  char.player_id = player_id;
  char.player_name = player_name;
  char.status = "active";

  // Trigger prompt generation if missing
  if (!char.current_prompt) {
    await triggerPromptGeneration(gameId, characterId).catch((err) => {
      console.error(`Failed to generate trigger prompt on take character:`, err);
    });
  }

  res.json({ success: true, character_id: characterId, game });
});

// POST to release a character back to the lobby pool
app.post("/api/games/:gameId/characters/:characterId/release", async (req, res) => {
  const { gameId, characterId } = req.params;

  const game = games[gameId];
  if (!game) return res.status(404).json({ success: false, error: "Game room not found." });
  const char = game.characters[characterId];
  if (!char) return res.status(404).json({ success: false, error: "Character not found." });

  // Free this character! Set player null & change status back to premade
  char.player_id = null;
  char.player_name = null;
  char.status = "premade";

  res.json({ success: true, game });
});

// POST to create a custom/new character with instructions
app.post("/api/games/:gameId/characters/create-custom", async (req, res) => {
  const { gameId } = req.params;
  const { player_name, player_id, custom_instruction } = req.body;

  const game = games[gameId];
  if (!game) return res.status(404).json({ success: false, error: "Game room not found." });

  // Create character ID
  const character_id = `char_cust_${Math.random().toString(36).substring(2, 9)}`;

  // Create Character Shell
  const shellCharacter = {
    character_id,
    player_id,
    player_name,
    status: "shell" as const,
    name: "Luodaan uutta hahmoasi...",
    role: "Muotoillaan uutta roolia...",
    goal: "Sopeutetaan tavoitteita skenaarioon...",
    goal_status: "active" as const,
    goal_history: [],
    dramaturgical_anchor: "Awaiting generation...",
    description: "Räätälöidään hahmon piirteitä annetun kuvauksen pohjalta...",
    current_dramaturgical_intention: "Initializing...",
    recent_history: [],
    relationships: [],
    current_prompt: null
  };

  game.characters[character_id] = shellCharacter;

  // Fire background generator for the complete custom character mapping
  generateFullCharacter(gameId, character_id, custom_instruction).catch((err) => {
    console.error(`Failed to generate custom character for ${character_id}:`, err);
    if (game.characters[character_id]) {
      game.characters[character_id].role = "Error: Klikkaa uusinta varten.";
    }
  });

  res.json({ success: true, character_id, game });
});

// Core generator that turns the Character Shell into an atmospheric active role
async function generateFullCharacter(gameId: string, characterId: string, customInstruction?: string) {
  const game = games[gameId];
  if (!game) return;
  const char = game.characters[characterId];
  if (!char) return;

  // Inspect existing characters in game to establish social connections / relationships
  const otherCharacters = Object.values(game.characters).filter((c: any) => c.character_id !== characterId && c.status === "active") as any[];
  const existingListDesc = otherCharacters.map((oc) => `- ${oc.name} (${oc.role}): ${oc.description}`).join("\n");

  const creationPrompt = `
    You are the dramaturgical writer. Generate a complex, rich character for our improvisation/acting game.
    The setting premise is: "${game.game_premise}"
    Underlying theme is: "${game.theme}"
    Atmospheric mood: "${game.mood}"
    Character Groups: ${JSON.stringify(game.core_character_groups)}

    The player's real name is: "${char.player_name}"
    
    Other characters already active in this game space:
    ${existingListDesc || "None (this is the starting character)"}

    ${customInstruction ? `CRITICAL PLAYER DESCRIPTION REQUIREMENT: The player has explicitly requested/guided their character role with this instruction: "${customInstruction}". Make sure to align their name, role, goal, and description matching this prompt absolutely!` : "Create a suitable character role. They must belong to one of the game's core character groups. Generate a name that sounds perfectly aligned with the premise."}
    
    Provide an action-driving "goal" (tavoite) and a powerful "dramaturgical_anchor" (dramaturginen ankkuri) like a secret, a lingering trauma, a item of value, or a heavy debt.
    Write a brief, punchy, active vivid description of how to portray this character.
    Generate 1 to 2 starting relationships to the existing characters listed (if any exist).
    
    Finally, formulate their starting internal narrative direction ("current_dramaturgical_intention") to set up the very first prompt generation.
    Ensure everything is tailored to fit the scenario's mood.

    Return the result in JSON mirroring this schema exactly:
  `;

  const relationshipSchema = {
    type: Type.OBJECT,
    properties: {
      target_character_id: { type: Type.STRING },
      target_character_name: { type: Type.STRING },
      description: { type: Type.STRING, description: "How they feel about this person, e.g. 'Uskoo heritseväisen salaisuuden hänestä'" },
      current_tension: { type: Type.STRING, description: "Atmospheric tension word, e.g. high, allied, secretive, distant, tense" }
    },
    required: ["target_character_id", "target_character_name", "description", "current_tension"]
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Atmospheric character name, e.g., 'Kaarle', 'Helena', 'Z-401'" },
      role: { type: Type.STRING, description: "Their societal or narratorial place, e.g., 'suvun hyljeksimä kuopus', 'johtava lääkäri'" },
      goal: { type: Type.STRING, description: "Vivid personal driving goal, e.g., 'Selvitä testamentin olinpaikka rikkomatta sopua.'" },
      dramaturgical_anchor: { type: Type.STRING, description: "A lingering secret, key item, trauma, debt, e.g., 'Kantaa mukanaan rikkirevittyä kirjelappua, jota ei täysin ymmärrä.'" },
      description: { type: Type.STRING, description: "vivid acting guidance, e.g., 'Kaarle on suvun nuori perillinen, joka yrittää näyttää itsevarmalta, puhuu nopeasti ja peittää epävarmuuden huumorilla.'" },
      current_dramaturgical_intention: { type: Type.STRING, description: "Internal motive direction for the first step play, e.g., 'Hahmo yrittää herättää piiloista luottamusta muihin.'" },
      relationships: {
        type: Type.ARRAY,
        items: relationshipSchema
      }
    },
    required: ["name", "role", "goal", "dramaturgical_anchor", "description", "current_dramaturgical_intention", "relationships"]
  };

  const parsed = await generateOllamaJson<any>({
    model: game.ai_model,
    prompt: creationPrompt,
    schema: responseSchema,
    temperature: 0.90
  });

  // Re-establish relationship bindings to actual IDs
  const relationshipsResolved = (parsed.relationships || []).map((r: any) => {
    // try to match with otherCharacter by name if target_character_id wasn't clearly mapped
    let realId = r.target_character_id;
    const match = otherCharacters.find((oc) => oc.name.toLowerCase() === r.target_character_name?.toLowerCase());
    if (match) {
      realId = match.character_id;
    } else if (otherCharacters.length > 0 && !otherCharacters.some(oc => oc.character_id === realId)) {
      realId = otherCharacters[0].character_id; // Default mapping
    }
    return {
      target_character_id: realId || "unknown",
      target_character_name: r.target_character_name || "Muu hahmo",
      description: r.description,
      current_tension: r.current_tension
    };
  });

  // Apply to game database record
  char.name = parsed.name || "Nimetön Hahmo";
  char.role = parsed.role || "Tuntematon rooli";
  char.goal = parsed.goal || "Vähittäinen integroituminen draamaan.";
  char.dramaturgical_anchor = parsed.dramaturgical_anchor || "Vapaus toimia.";
  char.description = parsed.description || "Kokenut ryhmän jäsen.";
  char.current_dramaturgical_intention = parsed.current_dramaturgical_intention || "Sopeutuminen tilanteeseen.";
  char.relationships = relationshipsResolved;
  char.status = "active";

  // Regenerate/bind reciprocal relationship from other active characters dynamically
  // to ensure multiplayer cohesion!
  if (otherCharacters.length > 0) {
    const randomOther = otherCharacters[Math.floor(Math.random() * otherCharacters.length)];
    randomOther.relationships.push({
      target_character_id: char.character_id,
      target_character_name: char.name,
      description: `Tuntenut ${char.name}:n jo pitkään. Epäilee tällä olevan salaisia aikeita.`,
      current_tension: "tense"
    });
  }

  // Instantly trigger generation of their first immersive prompt!
  await triggerPromptGeneration(gameId, characterId);
}

// Generates the player-facing prompt
async function triggerPromptGeneration(gameId: string, characterId: string) {
  const game = games[gameId];
  if (!game) return;
  const char = game.characters[characterId];
  if (!char) return;

  // Find target candidates
  const otherCharacters = Object.values(game.characters).filter((c: any) => c.character_id !== characterId && c.status === "active") as any[];
  const existingDesc = otherCharacters.map(oc => `- ID: ${oc.character_id}, Name: ${oc.name}, Role: ${oc.role}`).join("\n");

  const promptGenInstruction = `
    You are the dramaturgical director of Elopeli. Generate an active, playable atmospheric action prompt for character "${char.name}" (${char.role}).
    
    Context:
    - Setting Idea: "${game.game_premise}"
    - Current Setting plots: ${JSON.stringify(game.core_plots)}
    - Main scenario tone: "${game.mood}"
    
    This Character State:
    - Description: "${char.description}"
    - goal: "${char.goal}"
    - Dramaturgical anchor: "${char.dramaturgical_anchor}"
    - Current internal action intent: "${char.current_dramaturgical_intention}"
    - Social vocabulary of setting: ${JSON.stringify(game.dramaturgical_vocabulary.social_structures)}
    - Mechanical vocabulary of setting: ${JSON.stringify(game.dramaturgical_vocabulary.mechanical_structures)}
    - Recent personal history of actions: ${JSON.stringify(char.recent_history)}
    
    Other characters present:
    ${existingDesc || "No other characters generated yet. They are studying their settings individually style."}

    Generate the Player-facing instruction package.
    According to Elopeli guidelines:
    - DO NOT give tactical A/B/C options. The player has NO buttons! They are railroaded and guided strictly to keep the suspension of disbelief and theatrical posture intact.
    - Instead, output:
      1. One social_structure keyword from the setting vocabulary.
      2. One mechanical_structure keyword from the setting vocabulary.
      3. A target_of_action specifying WHO or WHAT the action is directed to.
      4. The "player_prompt" package containing:
         - prefix: A short, precise, concise, and highly tiivis viewpoint helper (1 to 2 sentences max). It must NOT describe global room events or scene facts that would cause descriptive desynchronizations between player perspectives. Instead, it must help the player understand their own character's narrow focus, viewpoint, and current emotional feeling preparing them mentally for the prompt.
         - action_instruction: A short list (1-3 bullets) of specific physical or emotional guidelines, e.g. "Vastaa Kaarlelle.", "Älä heti paljasta salaisuutta".
         - spoken_prompt: An array of 0 to 3 step-by-step lines outlining specifically what the character says and/or physically does in the room. Each array item represents a distinct step (dialogue or physical action). It must be structured with either 'Puhe: "lines"' or 'Toiminta: action description'. Total array size must be 0 to 3. (e.g., ['Puhe: "En ole varma tästä."', 'Toiminta: Astu askel taaksepäin ovelle.']).
         - postfix: A brief lingering physical action outline, e.g. "Katso Kaarlea epäilevästi." or "Käänny takaisin."
         
    Return the result in JSON matching this schema structure:
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      pre_action_intention: { type: Type.STRING, description: "Description of character's internal posture before starting action, e.g. 'Haluaa puolustaa Kaarlea jotta perhesopu säilyisi'" },
      social_structure: { type: Type.STRING, description: "Keyword matching one of the setting social structures" },
      mechanical_structure: { type: Type.STRING, description: "Keyword matching one of the setting mechanical structures" },
      target_of_action: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "e.g. another_character, space, object, secret" },
          id: { type: Type.STRING, description: "ID of target character if pointing to another active player, otherwise 'self' or 'scene'" },
          description: { type: Type.STRING, description: "Description, e.g. 'Avainlaatikko pöydällä'" }
        },
        required: ["type", "id", "description"]
      },
      player_prompt: {
        type: Type.OBJECT,
        properties: {
          prefix: { type: Type.STRING, description: "Situation/atmosphere setup, e.g. 'Huomaat Kaarlen katseen olevan sokean hermostunut.'" },
          action_instruction: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          spoken_prompt: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "0 to 3 bullet items of what the character says and/or does step-by-step in front of other players. Total array size must be 0 to 3."
          },
          postfix: { type: Type.STRING, description: "Postaction focus posture, e.g. 'Katso muiden reaktioita ennen kuin asettaudut aloillesi.'" }
        },
        required: ["prefix", "action_instruction", "spoken_prompt", "postfix"]
      },
      expected_dramaturgical_effect: { type: Type.STRING, description: "Internal engine expectation, e.g. 'Nostaa sosiaalista jännitettä tai paljastaa Kaarlen paineet'" }
    },
    required: ["pre_action_intention", "social_structure", "mechanical_structure", "target_of_action", "player_prompt", "expected_dramaturgical_effect"]
  };

  const parsed = await generateOllamaJson<any>({
    model: game.ai_model,
    prompt: promptGenInstruction,
    schema: responseSchema,
    temperature: 0.92
  });

  // Normalize spoken_prompt to be string[]
  let rawSpoken = parsed.player_prompt?.spoken_prompt;
  let normalizedSpoken: string[] = [];
  if (Array.isArray(rawSpoken)) {
    normalizedSpoken = rawSpoken.map((s: any) => String(s));
  } else if (typeof rawSpoken === "string" && rawSpoken.trim() !== "") {
    normalizedSpoken = [rawSpoken];
  }

  char.current_prompt = {
    character_id: characterId,
    pre_action_intention: parsed.pre_action_intention || char.current_dramaturgical_intention,
    social_structure: parsed.social_structure || "keskusteleva",
    mechanical_structure: parsed.mechanical_structure || "dialogi",
    target_of_action: parsed.target_of_action || { type: "scene", id: "scene", description: "Yleinen tilanne" },
    player_prompt: {
      prefix: parsed.player_prompt?.prefix || "Valmistaudut puhumaan.",
      action_instruction: parsed.player_prompt?.action_instruction || ["Osallistu tilanteeseen."],
      spoken_prompt: normalizedSpoken,
      postfix: parsed.player_prompt?.postfix || "Odotat muiden vastausta."
    },
    expected_dramaturgical_effect: parsed.expected_dramaturgical_effect || "Draama etenee"
  };
}

// Retry character generation if any network failure occurred
app.post("/api/games/:gameId/characters/:characterId/retry-generation", async (req, res) => {
  const { gameId, characterId } = req.params;
  const game = games[gameId];
  if (!game) return res.status(404).json({ success: false, error: "Game not found." });
  const char = game.characters[characterId];
  if (!char) return res.status(404).json({ success: false, error: "Character not found." });

  char.status = "shell";
  char.role = "Retrying generation...";
  
  generateFullCharacter(gameId, characterId).catch((err) => {
    console.error("Retried generation failed:", err);
    char.role = "Error: Click retry to reinitialize character generation.";
  });

  res.json({ success: true, character: char });
});

// API endpoint to complete a prompt (updates the character state and rolls next dramaturgy)
app.post("/api/games/:gameId/characters/:characterId/complete", async (req, res) => {
  const { gameId, characterId } = req.params;
  const { player_semantic_input } = req.body; // Client description of what happened in physical room

  const game = games[gameId];
  if (!game) {
    return res.status(404).json({ success: false, error: "Game room not found." });
  }

  const char = game.characters[characterId];
  if (!char) {
    return res.status(404).json({ success: false, error: "Your character was not found." });
  }

  const lastPrompt = char.current_prompt;
  if (!lastPrompt) {
    return res.status(400).json({ success: false, error: "You don't have an active prompt to complete." });
  }

  try {
    // Reconstruct other active characters to formulate dynamic state updates
    const activeChars = Object.values(game.characters).filter((c: any) => c.status === "active") as any[];

    const postActionPrompt = `
      You are the dramaturgical log processor. The player completed their acting/dialogue prompt:
      Spoken Dialogue was: ${JSON.stringify(lastPrompt.player_prompt.spoken_prompt)}
      Physical Target: ${JSON.stringify(lastPrompt.target_of_action)}
      Expectation was: "${lastPrompt.expected_dramaturgical_effect}"

      The player gave this brief explanation of what physically took place in the room:
      "${player_semantic_input || "Prompt completed successfully in full accordance with the scenario goals"}"

      Analyze what took place and update the Elopeli game state. Keep the game immersive and consistent!
      Determine:
      1. A post_action_interpretation (internal analysis of emotional impact, e.g. "Kaarlen nauru heikensi hahmon yritystä vaikuttaa vakavalta...").
      2. If this updates their active character goal (character_goal_update).
      3. Emotional relationship updates to any of the present active characters: ${JSON.stringify(activeChars.map(ac => ({ id: ac.character_id, name: ac.name })))}.
      4. Major plot updates to progress are active storyline plots: ${JSON.stringify(game.core_plots)}.

      Return the result in JSON matching this schema format:
    `;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        post_action_interpretation: { type: Type.STRING, description: "Emotional narrative summary of the outcome" },
        state_updates: {
          type: Type.OBJECT,
          properties: {
            character_goal_update: { type: Type.STRING, description: "New updated personal goal text if changed, or empty string to keep current" },
            relationship_updates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  target_character_id: { type: Type.STRING },
                  update: { type: Type.STRING, description: "Detailed description of how mood/tension shifted" },
                  current_tension: { type: Type.STRING, description: "e.g. guard, hostile, connected, cold, warm" }
                },
                required: ["target_character_id", "update", "current_tension"]
              }
            },
            plot_updates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  plot_id: { type: Type.STRING },
                  update: { type: Type.STRING, description: "Vivid detail of how the active setting shifted" },
                  status: { type: Type.STRING, description: "active or resolved" }
                },
                required: ["plot_id", "update", "status"]
              }
            }
          },
          required: ["character_goal_update", "relationship_updates", "plot_updates"]
        }
      },
      required: ["post_action_interpretation", "state_updates"]
    };

    const parsed = await generateOllamaJson<any>({
      model: game.ai_model,
      prompt: postActionPrompt,
      schema: responseSchema,
      temperature: 0.88
    });

    // Apply outcomes to state records
    const interp = parsed.post_action_interpretation || "Action was integrated into the atmospheric scenery.";
    
    // Add to history log
    char.recent_history.unshift(interp);
    if (char.recent_history.length > 5) char.recent_history.pop();

    const updates = parsed.state_updates || {};

    // 1. Update personal goal
    if (updates.character_goal_update && updates.character_goal_update.trim() !== "") {
      char.goal_history.push(char.goal);
      char.goal = updates.character_goal_update;
      char.goal_status = "changed";
    }

    // 2. Update player relationships
    if (updates.relationship_updates && Array.isArray(updates.relationship_updates)) {
      updates.relationship_updates.forEach((ru: any) => {
        const targetRel = char.relationships.find((r: any) => r.target_character_id === ru.target_character_id);
        if (targetRel) {
          targetRel.description = ru.update;
          targetRel.current_tension = ru.current_tension;
        } else {
          // Find other char's name
          const otherCharObj = game.characters[ru.target_character_id];
          if (otherCharObj) {
            char.relationships.push({
              target_character_id: ru.target_character_id,
              target_character_name: otherCharObj.name,
              description: ru.update,
              current_tension: ru.current_tension
            });
          }
        }
      });
    }

    // 3. Update core plot statuses in story
    if (updates.plot_updates && Array.isArray(updates.plot_updates)) {
      updates.plot_updates.forEach((pu: any) => {
        const matchPlot = game.core_plots.find((p: any) => p.plot_id === pu.plot_id);
        if (matchPlot) {
          matchPlot.description = pu.update;
          matchPlot.status = pu.status === "resolved" ? "resolved" : "active";
        }
      });
    }

    // Clear old active prompt and trigger the construction of their next turn prompt!
    char.current_prompt = null;
    
    // Create their next dramaturgical intention!
    char.current_dramaturgical_intention = `Pohjautuen edelliseen lopputulokseen: ${interp}. Hahmo pyrkii sopeuttamaan toimintaansa tavoitteensa suuntaan.`;

    // Trigger generation of the next unique interactive play cue (robustly caught to prevent page locks)
    try {
      await triggerPromptGeneration(gameId, characterId);
    } catch (err) {
      console.warn(`[Safe Warning] Next prompt background generation failed on complete:`, err);
    }

    res.json({
      success: true,
      post_action_interpretation: interp,
      character: char,
      game: game
    });
  } catch (error: any) {
    console.error(`Error completing prompt task for character ${characterId}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to finalize drama state segment." });
  }
});

// Manual endpoint to retry/generate prompt for a character if it is missing or failed previously
app.post("/api/games/:gameId/characters/:characterId/retry-prompt", async (req, res) => {
  const { gameId, characterId } = req.params;
  const game = games[gameId];
  if (!game) return res.status(404).json({ success: false, error: "Peliä ei löytynyt." });
  const char = game.characters[characterId];
  if (!char) return res.status(404).json({ success: false, error: "Hahmoa ei löytynyt." });

  try {
    await triggerPromptGeneration(gameId, characterId);
    res.json({ success: true, game, character: char });
  } catch (err: any) {
    console.error(`Failed manual prompt generation retry for ${characterId}:`, err);
    res.status(500).json({ success: false, error: err.message || "Seuraavan vuoron luonti epäonnistui. Yritä uudelleen hetken kuluttua." });
  }
});


async function startServer() {
  // Serve static frontend assets for production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Integrate Vite Dev Middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Bind server to port 3000 and standard host 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Elopeli Server] Engine booted up on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to boot Elopeli engine server:", err);
});
