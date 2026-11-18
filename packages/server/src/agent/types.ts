import type { EvidencePath } from "../graph-path.js";

export type AgentAnswer = {
  question: string;
  answer: string;
  intent: string;
  planner: "rules" | "llm";
  cypher: string[];
  path: EvidencePath;
  highlights?: string[];
};