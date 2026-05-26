export type AvatarCursorPoint = {
  x: number;
  y: number;
};

export type AvatarCursorRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export type AvatarEyeOffset = {
  x: number;
  y: number;
};

const RESTING_EYE_OFFSET: AvatarEyeOffset = { x: 0, y: 0 };
const EYE_TRACKING_GAIN = 1.35;
const UPWARD_EYE_OFFSET_MULTIPLIER = 1.35;
const DOWNWARD_EYE_OFFSET_MULTIPLIER = 0.92;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundOffset(value: number) {
  return Number(value.toFixed(2));
}

export function deriveAvatarEyeOffset({
  avatarRect,
  maxOffset = 7.5,
  pointer,
}: {
  avatarRect: AvatarCursorRect | null;
  maxOffset?: number;
  pointer: AvatarCursorPoint | null;
}): AvatarEyeOffset {
  if (
    !avatarRect ||
    !pointer ||
    avatarRect.width <= 0 ||
    avatarRect.height <= 0 ||
    maxOffset <= 0
  ) {
    return RESTING_EYE_OFFSET;
  }

  const centerX = avatarRect.left + avatarRect.width / 2;
  const centerY = avatarRect.top + avatarRect.height / 2;
  const normalizedX =
    ((pointer.x - centerX) / (avatarRect.width / 2)) * EYE_TRACKING_GAIN;
  const normalizedY =
    ((pointer.y - centerY) / (avatarRect.height / 2)) * EYE_TRACKING_GAIN;
  const verticalMaxOffset =
    normalizedY < 0
      ? maxOffset * UPWARD_EYE_OFFSET_MULTIPLIER
      : maxOffset * DOWNWARD_EYE_OFFSET_MULTIPLIER;

  return {
    x: roundOffset(clamp(normalizedX, -1, 1) * maxOffset),
    y: roundOffset(clamp(normalizedY, -1, 1) * verticalMaxOffset),
  };
}
