import React from "react";

import type { AvatarExpProgress } from "./avatar-exp-panel";

type AvatarExpIndicatorProps = {
  progression: AvatarExpProgress;
};

export function AvatarExpIndicator({ progression }: AvatarExpIndicatorProps) {
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(progression.progressPercent)),
  );

  return (
    <div
      aria-label={`Avatar EXP level ${progression.level}, ${progression.totalExp} total EXP`}
      className="portal-avatar-exp-indicator"
    >
      <div className="portal-avatar-exp-indicator__meta">
        <span>LV {progression.level}</span>
        <strong>{progression.totalExp} EXP</strong>
      </div>
      <div
        aria-label={`${progressPercent}% EXP progress`}
        className="portal-avatar-exp-indicator__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
