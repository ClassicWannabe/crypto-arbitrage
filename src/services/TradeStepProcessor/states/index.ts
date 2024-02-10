import { ProcessedState } from "./ProcessedState.js";
import { ProcessingState } from "./ProcessingState.js";

export const STATES = {
  [ProcessingState.status]: ProcessingState,
  [ProcessedState.status]: ProcessedState,
} as const;
