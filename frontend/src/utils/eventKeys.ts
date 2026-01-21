// Event key utilities for multi-type event selection
// Keys are formatted as "type:id" e.g. "activity:123", "browser:456"

export type EventKey = string;

export type EventType = 'activity' | 'browser' | 'git' | 'shell' | 'file' | 'afk' | 'screenshot';

export function makeEventKey(type: EventType, id: number): EventKey {
  return `${type}:${id}`;
}

export function parseEventKey(key: EventKey): { type: EventType; id: number } {
  const [type, idStr] = key.split(':');
  return { type: type as EventType, id: parseInt(idStr, 10) };
}
