export interface UndoEntry {
  label: string;
  undoFn: () => void;
  timestamp: number;
}

type Listener = () => void;

const MAX_STACK_SIZE = 10;

let stack: UndoEntry[] = [];
let listeners: Listener[] = [];

function notify() {
  for (const fn of listeners) {
    fn();
  }
}

export function pushUndo(label: string, undoFn: () => void) {
  stack.push({ label, undoFn, timestamp: Date.now() });
  if (stack.length > MAX_STACK_SIZE) {
    stack = stack.slice(stack.length - MAX_STACK_SIZE);
  }
  notify();
}

export function popUndo(): UndoEntry | undefined {
  const entry = stack.pop();
  if (entry) {
    entry.undoFn();
    notify();
  }
  return entry;
}

export function peekUndo(): UndoEntry | undefined {
  return stack[stack.length - 1];
}

export function getUndoStack(): readonly UndoEntry[] {
  return stack;
}

export function subscribe(listener: Listener) {
  listeners.push(listener);
}

export function unsubscribe(listener: Listener) {
  listeners = listeners.filter(l => l !== listener);
}
