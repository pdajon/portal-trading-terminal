# Portal V1 Screenshot Checklist

Capture screenshots after running the demo reset and loading `http://localhost:3002/terminal`.

## Trade Mode

- Chart is the dominant first read.
- Trade controls are compact and contextual.
- Market entry confirmation is visible.
- Explicit sizing display is visible: USD size, direction, leverage, and available funds context.
- No stuck loading states are visible.

## Magic Trade

- Magic Trade composer/rule surface is open.
- Source condition and target action are visible.
- Rule state is visible and bounded.
- The surface does not crowd the chart.

## Discipline

- Discipline mode owns the footer command deck.
- Require Protection rule is visible.
- Blocked Time Window rule is visible.
- Trade controls are not visible inside Discipline mode.

## Override Bond Modal

- Modal is opened from a locked rule.
- Rule being overridden is identifiable.
- Simulated USDC amount and split are visible.
- Copy does not imply real USDC settlement.

## AI Coach Warning

- AI Coach warning is visible.
- Warning reason/source is visible.
- Severity styling is amber/red, not generic primary.
- Warning copy stays cautious when confidence is low.

## Journal Trade Review

- Journal Trade Review is open.
- Native Journal entry context is visible.
- Plan followed/broken/unclear review control is visible.
- Imported baseline trades are not presented as native Journal entries.

## Operator Diagnosis

- Diagnosis mode owns the footer command deck.
- Finding summary and evidence context are visible.
- `Review Plan` is visible.
- Trade controls are not visible inside Diagnosis mode.

## Session Logs

- Session Logs owns the full footer width.
- Filters read as subtle tabs/underlines, not bulky pills.
- Confirmed action entries are visible.
- The log surface remains low-clutter and does not compete with the chart.
