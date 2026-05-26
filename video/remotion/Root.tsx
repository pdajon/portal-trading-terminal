import { Composition } from "remotion";
import {
  MagicTradeExplainer,
  MAGIC_TRADE_DURATION_FRAMES,
  MAGIC_TRADE_FPS,
  MAGIC_TRADE_HEIGHT,
  MAGIC_TRADE_WIDTH,
} from "./MagicTradeExplainer";
import {
  JournalSetupPreviewLab,
  JOURNAL_SETUP_PREVIEW_LAB_DURATION_FRAMES,
  JOURNAL_SETUP_PREVIEW_LAB_FPS,
  JOURNAL_SETUP_PREVIEW_LAB_HEIGHT,
  JOURNAL_SETUP_PREVIEW_LAB_WIDTH,
} from "./JournalSetupPreviewLab";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="MagicTradeExplainer"
        component={MagicTradeExplainer}
        durationInFrames={MAGIC_TRADE_DURATION_FRAMES}
        fps={MAGIC_TRADE_FPS}
        width={MAGIC_TRADE_WIDTH}
        height={MAGIC_TRADE_HEIGHT}
      />
      <Composition
        id="JournalSetupPreviewLab"
        component={JournalSetupPreviewLab}
        durationInFrames={JOURNAL_SETUP_PREVIEW_LAB_DURATION_FRAMES}
        fps={JOURNAL_SETUP_PREVIEW_LAB_FPS}
        width={JOURNAL_SETUP_PREVIEW_LAB_WIDTH}
        height={JOURNAL_SETUP_PREVIEW_LAB_HEIGHT}
      />
    </>
  );
};
