import React from "react";

import type { AvatarArmoryShellPiece } from "@/features/discipline/lib/avatar-armor-layers";

type AvatarArmoryShellLayerProps = {
  pieces: AvatarArmoryShellPiece[];
};

export function AvatarArmoryShellLayer({ pieces }: AvatarArmoryShellLayerProps) {
  return (
    <div className="portal-avatar-armory-shell-layer" aria-hidden="true">
      {pieces.map((piece) => (
        <img
          key={piece.id}
          alt=""
          className="portal-avatar-armory-shell-piece"
          data-active={piece.active ? "true" : "false"}
          data-shell-id={piece.id}
          src={piece.assetSrc}
        />
      ))}
    </div>
  );
}
