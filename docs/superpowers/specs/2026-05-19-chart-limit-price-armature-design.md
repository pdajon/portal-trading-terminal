# Chart Limit Price Armature Design

## Summary

Replace the chart-based limit placement instruction toast with a chart-native price-placement armature. The current instruction surface still reads as a floating UI toast. The desired direction is closer to a temporary chart tool state: a small label attached to the active horizontal price guide.

## Approved Direction

- Visual direction: price armature, based on option C from the second visual board.
- Copy: `Select limit price`.
- Surface: tiny translucent pill label, not a toast card.
- Placement: centered on the chart price guide / crosshair line area while chart limit placement is active.
- Decorative structure: thin horizontal line segments extend from the label so the instruction feels attached to the chart.
- Visual weight: quiet, low contrast, no icon, no large border, no glow box, no animated pulse.

## Behavior

- Show only when chart-based limit order placement is active.
- Hide immediately after the user selects a price.
- Do not show for typed limit price mode.
- Do not use this armature for order processing, filled, rejected, canceled, warning, or neutral system events.
- Processing and order-result notifications continue to use the existing bottom-right toast card system.

## Scope

This is a visual and ownership change only.

Do not change:
- trading execution behavior
- API payloads
- session logging
- discipline gates
- pending order behavior
- market/limit order state transitions

## Implementation Notes

- Keep the existing `PortalToastCard` card mode for bottom-right order/system toasts.
- Replace or bypass the `chartInstruction` toast rendering path with a chart-armature renderer.
- The chart armature should live inside the chart area owner so it aligns with the chart, not the full viewport.
- Use concise chart-state copy: `Select limit price`.
- Preserve mobile clamping so the label stays inside the chart viewport.

## Verification

- Run `npm test`.
- Run `npm run build`.
- Restart the dev server on `http://localhost:3002`.
- Verify `/terminal` loads.
- In Trade mode, switch limit price entry to `Click Chart` and confirm:
  - the armature appears on the chart
  - the copy reads `Select limit price`
  - it looks like a chart guide, not a toast card
  - it disappears after price selection
  - processing/result notifications still appear bottom-right
