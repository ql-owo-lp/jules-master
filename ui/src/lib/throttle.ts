import { Session, Settings } from "./types";

/**
 * Determines if we should interact with a session based on throttling rules.
 * 
 * Rules:
 * 1. If we haven't interacted recently (< minInterval), wait.
 * 2. If we have interacted recently, allow interaction ONLY IF:
 *    - There is new activity from the remote side (updateTime > lastInteractionAt)
 *    - OR the retry timeout has passed since the last interaction (timeout > retryTimeout)
 */
export function shouldInteract(session: Session, settings: Settings): boolean {
    const lastInteraction = session.lastInteractionAt || 0;
    const now = Date.now();

    // If never interacted, go ahead.
    if (lastInteraction === 0) {
        return true;
    }

    // 1. Enforce minimum interval between our actions
    const minIntervalMs = (settings.minSessionInteractionInterval || 60) * 1000;
    if (now - lastInteraction < minIntervalMs) {
        return false;
    }

    // 2. Check for remote activity
    // API returns createTime/updateTime as ISO strings.
    const remoteUpdate = session.updateTime ? new Date(session.updateTime).getTime() : 0;
    
    // If the session was updated by the remote system AFTER our last interaction, we can proceed.
    // (Assuming updateTime reflects agent/system responses, not just our own writes - typically true for Jules API where agent responses update the session)
    if (remoteUpdate > lastInteraction) {
        return true;
    }

    // 3. check for retry timeout
    // If we haven't seen updates but enough time has passed, we might want to poke it again (retry).
    const retryTimeoutMs = (settings.retryTimeout || 1200) * 1000;
    if (now - lastInteraction > retryTimeoutMs) {
        return true;
    }

    return false;
}
