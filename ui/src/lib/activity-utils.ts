
import type { Activity } from "@/lib/types";

export function areActivitiesEqual(prev: Activity, next: Activity) {
  if (prev === next) return true;
  if (prev.id !== next.id) return false;

  // Check basic fields
  if (prev.description !== next.description) return false;
  if (prev.createTime !== next.createTime) return false;
  if (prev.originator !== next.originator) return false;

  // Check fields used in render
  if (prev.agentMessaged?.agentMessage !== next.agentMessaged?.agentMessage) return false;
  if (prev.userMessaged?.userMessage !== next.userMessaged?.userMessage) return false;

  // Plan Generated
  if (prev.planGenerated !== next.planGenerated) {
      if (!prev.planGenerated || !next.planGenerated) return false;
      // Deep compare plan using JSON.stringify as plans are relatively small
      if (JSON.stringify(prev.planGenerated) !== JSON.stringify(next.planGenerated)) return false;
  }

  // Plan Approved
  if (prev.planApproved !== next.planApproved) {
      if (!prev.planApproved || !next.planApproved) return false;
      if (prev.planApproved.planId !== next.planApproved.planId) return false;
  }

  // Progress Updated
  if (prev.progressUpdated !== next.progressUpdated) {
      if (!prev.progressUpdated || !next.progressUpdated) return false;
      if (prev.progressUpdated.title !== next.progressUpdated.title) return false;
      if (prev.progressUpdated.description !== next.progressUpdated.description) return false;
  }

  // Session Completed
  if (!!prev.sessionCompleted !== !!next.sessionCompleted) return false;

  // Session Failed
  if (prev.sessionFailed !== next.sessionFailed) {
      if (!prev.sessionFailed || !next.sessionFailed) return false;
      if (prev.sessionFailed.reason !== next.sessionFailed.reason) return false;
  }

  // Artifacts
  const prevArtifacts = prev.artifacts || [];
  const nextArtifacts = next.artifacts || [];

  if (prevArtifacts.length !== nextArtifacts.length) return false;

  for (let i = 0; i < prevArtifacts.length; i++) {
      const p = prevArtifacts[i];
      const n = nextArtifacts[i];

      // BashOutput
      if (p.bashOutput !== n.bashOutput) {
           if (!p.bashOutput || !n.bashOutput) return false;
           if (p.bashOutput.output !== n.bashOutput.output) return false;
           if (p.bashOutput.command !== n.bashOutput.command) return false;
           if (p.bashOutput.exitCode !== n.bashOutput.exitCode) return false;
      }

      // ChangeSet
      if (p.changeSet !== n.changeSet) {
           if (!p.changeSet || !n.changeSet) return false;
           if (p.changeSet.source !== n.changeSet.source) return false;

           // Check GitPatch
           if (p.changeSet.gitPatch !== n.changeSet.gitPatch) {
               if (!p.changeSet.gitPatch || !n.changeSet.gitPatch) return false;
               if (p.changeSet.gitPatch.unidiffPatch !== n.changeSet.gitPatch.unidiffPatch) return false;
               if (p.changeSet.gitPatch.suggestedCommitMessage !== n.changeSet.gitPatch.suggestedCommitMessage) return false;
               if (p.changeSet.gitPatch.baseCommitId !== n.changeSet.gitPatch.baseCommitId) return false;
           }
      }

      // Note: We intentionally skip 'media' check here if it's not rendered by ActivityContent.
      // Currently ActivityContent does not render media.
  }

  return true;
}

export function mergeActivities(prev: Activity[], next: Activity[]): Activity[] {
  const sortedNext = [...next].sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());

  // Optimization: If empty, return empty
  if (sortedNext.length === 0) return [];
  if (prev.length === 0) return sortedNext;

  let hasChanges = false;
  const prevMap = new Map(prev.map(a => [a.id, a]));

  const newActivities = sortedNext.map(n => {
      const p = prevMap.get(n.id);
      if (p && areActivitiesEqual(p, n)) {
          return p;
      }
      hasChanges = true;
      return n;
  });

  // If nothing changed (including length), return prev reference to avoid re-renders
  if (!hasChanges && prev.length === newActivities.length) {
      return prev;
  }

  return newActivities;
}
