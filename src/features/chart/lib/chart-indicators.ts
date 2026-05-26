import type { PriceCandle } from "@/features/chart/types";

export type ChartIndicatorPoint = {
  time: number;
  value: number;
};

export type ChartMacdData = {
  histogram: ChartIndicatorPoint[];
  macd: ChartIndicatorPoint[];
  signal: ChartIndicatorPoint[];
};

function isValidPeriod(period: number) {
  return Number.isInteger(period) && period > 0;
}

function toFinitePoint(time: number, value: number): ChartIndicatorPoint | null {
  return Number.isFinite(value) ? { time, value } : null;
}

export function calculateSma(
  candles: PriceCandle[],
  period: number,
  selector: (candle: PriceCandle) => number = (candle) => candle.close,
) {
  if (!isValidPeriod(period) || candles.length < period) {
    return [];
  }

  const points: ChartIndicatorPoint[] = [];
  let rollingSum = 0;

  candles.forEach((candle, index) => {
    rollingSum += selector(candle);

    if (index >= period) {
      rollingSum -= selector(candles[index - period]);
    }

    if (index >= period - 1) {
      const point = toFinitePoint(candle.time, rollingSum / period);

      if (point) {
        points.push(point);
      }
    }
  });

  return points;
}

export function calculateEma(
  candles: PriceCandle[],
  period: number,
  selector: (candle: PriceCandle) => number = (candle) => candle.close,
) {
  if (!isValidPeriod(period) || candles.length < period) {
    return [];
  }

  const points: ChartIndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);
  let ema = 0;

  candles.forEach((candle, index) => {
    const value = selector(candle);

    if (index < period) {
      ema += value / period;

      if (index === period - 1) {
        const point = toFinitePoint(candle.time, ema);

        if (point) {
          points.push(point);
        }
      }

      return;
    }

    ema = (value - ema) * multiplier + ema;
    const point = toFinitePoint(candle.time, ema);

    if (point) {
      points.push(point);
    }
  });

  return points;
}

export function calculateVwap(candles: PriceCandle[]) {
  const points: ChartIndicatorPoint[] = [];
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const volume = Number(candle.volume);

    if (!Number.isFinite(volume) || volume <= 0) {
      continue;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativePriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;

    const point = toFinitePoint(candle.time, cumulativePriceVolume / cumulativeVolume);

    if (point) {
      points.push(point);
    }
  }

  return points;
}

export function calculateAtr(candles: PriceCandle[], period = 14) {
  if (!isValidPeriod(period) || candles.length < period + 1) {
    return [];
  }

  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;

    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  const points: ChartIndicatorPoint[] = [];
  let atr = 0;

  trueRanges.forEach((trueRange, index) => {
    if (index < period) {
      atr += trueRange / period;

      if (index === period - 1) {
        const point = toFinitePoint(candles[index + 1].time, atr);

        if (point) {
          points.push(point);
        }
      }

      return;
    }

    atr = (atr * (period - 1) + trueRange) / period;
    const point = toFinitePoint(candles[index + 1].time, atr);

    if (point) {
      points.push(point);
    }
  });

  return points;
}

export function calculateRsi(candles: PriceCandle[], period = 14) {
  if (!isValidPeriod(period) || candles.length < period + 1) {
    return [];
  }

  let averageGain = 0;
  let averageLoss = 0;
  const points: ChartIndicatorPoint[] = [];

  for (let index = 1; index <= period; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    averageGain += Math.max(change, 0) / period;
    averageLoss += Math.max(-change, 0) / period;
  }

  const firstRsi =
    averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  points.push({ time: candles[period].time, value: firstRsi });

  for (let index = period + 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    averageGain =
      (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss =
      (averageLoss * (period - 1) + Math.max(-change, 0)) / period;

    const rsi =
      averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
    const point = toFinitePoint(candles[index].time, rsi);

    if (point) {
      points.push(point);
    }
  }

  return points;
}

function calculateEmaForPoints(points: ChartIndicatorPoint[], period: number) {
  if (!isValidPeriod(period) || points.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const emaPoints: ChartIndicatorPoint[] = [];
  let ema = 0;

  points.forEach((point, index) => {
    if (index < period) {
      ema += point.value / period;

      if (index === period - 1) {
        emaPoints.push({ time: point.time, value: ema });
      }

      return;
    }

    ema = (point.value - ema) * multiplier + ema;
    emaPoints.push({ time: point.time, value: ema });
  });

  return emaPoints;
}

export function calculateMacd(
  candles: PriceCandle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): ChartMacdData {
  const fastEma = calculateEma(candles, fastPeriod);
  const slowEma = calculateEma(candles, slowPeriod);
  const slowByTime = new Map(slowEma.map((point) => [point.time, point.value]));
  const macd = fastEma.flatMap((point) => {
    const slowValue = slowByTime.get(point.time);

    if (slowValue === undefined) {
      return [];
    }

    return [{ time: point.time, value: point.value - slowValue }];
  });
  const signal = calculateEmaForPoints(macd, signalPeriod);
  const signalByTime = new Map(signal.map((point) => [point.time, point.value]));
  const histogram = macd.flatMap((point) => {
    const signalValue = signalByTime.get(point.time);

    if (signalValue === undefined) {
      return [];
    }

    return [{ time: point.time, value: point.value - signalValue }];
  });

  return { histogram, macd, signal };
}
