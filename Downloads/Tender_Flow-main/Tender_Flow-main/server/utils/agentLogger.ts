import { LogEntry, AgentName } from "../../types";

export function createLog(
  agent: AgentName,
  message: string,
  data?: unknown
): LogEntry {
  return {
    timestamp: new Date(),
    agent,
    message,
    data: data
      ? JSON.stringify(data, null, 2).slice(0, 3000) // safety cap
      : undefined,
  };
}
