/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Plot {
  plot_id: string;
  description: string;
  status: "active" | "resolved";
}

export interface CharacterGroup {
  group_id: string;
  name: string;
  description: string;
}

export interface VocabularyItem {
  keyword: string;
  description: string;
}

export interface DramaturgicalVocabulary {
  social_structures: VocabularyItem[];
  mechanical_structures: VocabularyItem[];
  target_types: VocabularyItem[];
}

export interface ThemeConfig {
  name: string;
  primary: string;      // e.g. "#22c55e"
  secondary: string;    // e.g. "#15803d"
  accent: string;       // e.g. "#16a34a"
  bg: string;           // e.g. "#020617"
  textColor: string;    // e.g. "#f8fafc"
  cardBg: string;       // e.g. "#0f172a"
  styleClasses: string; // Tailwind overrides
}

export interface GameState {
  game_id: string;      // Room Pin / Game ID
  ai_model: string;     // Ollama model selected when the game was created
  created_at: number;
  game_premise: string; // The user-entered initial idea
  theme: string;
  mood: string;
  rhythm: string;
  core_plots: Plot[];
  core_character_groups: CharacterGroup[];
  dramaturgical_vocabulary: DramaturgicalVocabulary;
  themeConfig: ThemeConfig;
  characters: Record<string, Character>; // Map character_id -> Character
}

export interface Relationship {
  target_character_id: string;
  target_character_name: string;
  description: string;
  current_tension: string; // e.g., "high", "guarded", "affectionate", "allied"
}

export interface CharacterPrompt {
  prefix: string;
  action_instruction: string[];
  spoken_prompt: string | string[];
  postfix: string;
}

export interface PromptObject {
  character_id: string;
  pre_action_intention: string;
  social_structure: string;       // keyword from game vocabulary
  mechanical_structure: string;   // keyword from game vocabulary
  target_of_action: {
    type: string;
    id: string;
    description: string;
  };
  player_prompt: CharacterPrompt;
  expected_dramaturgical_effect: string;
}

export interface Character {
  character_id: string;
  player_id: string | null;              // unique ID for the playing device/user, null if pre-made and unassigned
  player_name: string | null;            // real person name, null if pre-made and unassigned
  status: "shell" | "active" | "premade";
  name: string;                   // generated character name
  role: string;                   // generated social role
  goal: string;
  goal_status: "active" | "completed" | "changed";
  goal_history: string[];
  dramaturgical_anchor: string;   // item, secret, debt, promise etc.
  description: string;            // character description
  current_dramaturgical_intention: string;
  recent_history: string[];       // past action outcomes
  relationships: Relationship[];
  current_prompt: PromptObject | null;
}

export interface GameListItem {
  game_id: string;
  theme: string;
  mood: string;
  ai_model?: string;
  created_at: number;
}
