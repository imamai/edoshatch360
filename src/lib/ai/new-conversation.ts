/**
 * Starting afresh in edos.ai.
 *
 * The unsaved thread lives in `sessionStorage` so an answer survives a
 * reload, which means "new conversation" has to clear it as well as move to
 * the empty page. Two places offer that — the button above the chat and a
 * row in the sidebar's history — and the sidebar must not import the chat to
 * get it, or every page in the app would ship the assistant's bundle.
 */

export const THREAD_KEY = "edoshatch360:assistant-draft";
export const NEW_CONVERSATION = "edoshatch360:new-conversation";

/** Forget the unsaved thread in this tab and tell an open chat to clear. */
export function startNewConversation() {
  try {
    sessionStorage.removeItem(THREAD_KEY);
  } catch {
    /* nothing kept */
  }
  window.dispatchEvent(new Event(NEW_CONVERSATION));
}
