# Elopeli Threads / Säikeet

## Role in the Elopeli lineage

Elopeli Threads is the async / multi-device branch that follows the Rautatie experiments.

Rautatie proved that strong dramaturgical rails, scene limits, and taxonomy-driven prompting can create coherent improvised play. Threads moves that question back toward the original Elopeli architecture: each player has a private device, each character receives their own prompt, and the shared game state is updated between individual dramaturgical turns.

## What this prototype tests

- Game creation from a compact premise.
- Scenario-specific dramaturgical vocabulary.
- Player-specific character shells and premade characters.
- Private action prompts for separate devices.
- Post-action state interpretation before the next prompt.
- Model selection as part of the runtime setup.

## Technical note

This version started as a Gemini AI Studio prototype. The archived repository version replaces Gemini with Ollama:

- `/api/models` scans Ollama `/api/tags`.
- The facilitator chooses a model before creating a game.
- The selected model is stored on the game state.
- Scenario, character, prompt, and state-update generations all use that same model.

This makes the prototype useful for testing whether smaller or local models can handle the real architectural burden: assembling the correct context for each short generation cycle.

## Limitation

The game state is currently in-memory only. Restarting the server clears active rooms. This is acceptable for the prototype archive but not for a production rehearsal or workshop setup.
