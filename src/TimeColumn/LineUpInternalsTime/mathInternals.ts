import * as equalImpl from "fast-deep-equal";
import { pushAll } from "./dateinternals";
// keep here to have a "real" export for webpack not just interfaces

/**
 * deep equal comparison
 */
export const equal: (a: any, b: any) => boolean =
  typeof equalImpl === "function" ? equalImpl : (<any>equalImpl).default;

export interface IBin<T> {
  /**
   * bin start
   */
  x0: T;
  /**
   * bin end
   */
  x1: T;
  /**
   * bin count
   */
  count: number;
}

export declare type INumberBin = IBin<number>;

/**
 * compares two number whether they are similar up to delta
 * @param {number} a first numbre
 * @param {number} b second number
 * @param {number} delta
 * @returns {boolean} a and b are similar
 * @internal
 */
export function similar(a: number, b: number, delta = 0.5) {
  if (a === b) {
    return true;
  }
  return Math.abs(a - b) < delta;
}

export interface IBoxPlotData {
  readonly min: number;
  readonly max: number;
  readonly median: number;
  readonly q1: number;
  readonly q3: number;
  readonly outlier?: number[];
  readonly whiskerLow?: number;
  readonly whiskerHigh?: number;
}

export interface IAdvancedBoxPlotData extends IBoxPlotData {
  readonly mean: number;

  readonly missing: number;
  readonly count: number;
}

export interface IHistogramStats<T> {
  readonly min: T | null;
  readonly max: T | null;

  readonly missing: number;
  readonly count: number;

  readonly maxBin: number;
  readonly hist: ReadonlyArray<IBin<T>>;
}

export interface IStatistics extends IHistogramStats<number> {
  readonly mean: number;
}

export interface ICategoricalBin {
  cat: string;
  count: number;
}

export declare type IDateBin = IBin<Date>;

export interface ICategoricalStatistics {
  readonly missing: number;
  readonly count: number;

  readonly maxBin: number;
  readonly hist: ReadonlyArray<ICategoricalBin>;
}

export declare type IDateHistGranularity = "year" | "month" | "day";

export interface IDateStatistics extends IHistogramStats<Date> {
  readonly histGranularity: IDateHistGranularity;
}

export function quantile(
  values: ArrayLike<number>,
  quantile: number,
  length = values.length
) {
  if (length === 0) {
    return NaN;
  }
  const target = (length - 1) * quantile;
  const index = Math.floor(target);
  if (index === target) {
    return values[index];
  }
  const v = values[index];
  const vAfter = values[index + 1];
  return v + (vAfter - v) * (target - index); // shift by change
}

export function boxplotBuilder(
  fixedLength?: number
): IBuilder<number, IAdvancedBoxPlotData> & {
  buildArr: (s: Float32Array) => IAdvancedBoxPlotData;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let length = 0;
  let missing = 0;

  // if fixed size use the typed array else a regular array
  const values: number[] = [];
  const vs: Float32Array | null =
    fixedLength != null ? new Float32Array(fixedLength) : null;

  const push = (v: number) => {
    length += 1;
    if (v == null || isNaN(v)) {
      missing += 1;
      return;
    }
    if (v < min) {
      min = v;
    }
    if (v > max) {
      max = v;
    }
    sum += v;
  };

  const pushAndSave = (v: number) => {
    push(v);
    if (vs) {
      vs[length] = v;
    } else {
      values.push(v);
    }
  };

  const invalid = {
    min: NaN,
    max: NaN,
    mean: NaN,
    missing,
    count: length,
    whiskerHigh: NaN,
    whiskerLow: NaN,
    outlier: [],
    median: NaN,
    q1: NaN,
    q3: NaN
  };

  const buildImpl = (s: ArrayLike<number>) => {
    const valid = length - missing;
    const median = quantile(s, 0.5, valid)!;
    const q1 = quantile(s, 0.25, valid)!;
    const q3 = quantile(s, 0.75, valid)!;

    const iqr = q3 - q1;
    const left = q1 - 1.5 * iqr;
    const right = q3 + 1.5 * iqr;

    let outlier: number[] = [];
    // look for the closests value which is bigger than the computed left
    let whiskerLow = left;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < valid; ++i) {
      const v = s[i];
      if (left < v) {
        whiskerLow = v;
        break;
      }
      // outlier
      outlier.push(v);
    }
    // look for the closests value which is smaller than the computed right
    let whiskerHigh = right;
    const reversedOutliers: number[] = [];
    for (let i = valid - 1; i >= 0; --i) {
      const v = s[i];
      if (v < right) {
        whiskerHigh = v;
        break;
      }
      // outlier
      reversedOutliers.push(v);
    }

    outlier = outlier.concat(reversedOutliers.reverse());

    return {
      min,
      max,
      count: length,
      missing,
      mean: sum / valid,
      whiskerHigh,
      whiskerLow,
      outlier,
      median,
      q1,
      q3
    };
  };

  const build = () => {
    const valid = length - missing;

    if (valid === 0) {
      return invalid;
    }

    const s = vs ? vs.sort() : Float32Array.from(values).sort();
    return buildImpl(s);
  };

  const buildArr = (vs: Float32Array) => {
    const s = vs.slice().sort();
    // tslint:disable-next-line:prefer-for-of
    for (let j = 0; j < vs.length; ++j) {
      push(vs[j]);
    }
    // missing are the last
    return buildImpl(s);
  };

  return {
    push: pushAndSave,
    build,
    buildArr,
    pushAll: pushAll(pushAndSave)
  };
}

function pushDateHist(hist: IDateBin[], v: Date, count: number = 1) {
  if (v < hist[0].x1) {
    hist[0].count += count;
    return;
  }
  const l = hist.length - 1;
  if (v > hist[l].x0) {
    hist[l].count += count;
    return;
  }
  if (l === 2) {
    hist[1].count += count;
    return;
  }

  let low = 1;
  let high = l;
  // binary search
  while (low < high) {
    const center = Math.floor((high + low) / 2);
    if (v < hist[center].x1) {
      high = center;
    } else {
      low = center + 1;
    }
  }
  hist[low].count += count;
}

function computeGranularity(
  min: Date | null,
  max: Date | null
): { histGranularity: IDateHistGranularity; hist: IDateBin[] } {
  if (min == null || max == null) {
    return { histGranularity: "year", hist: [] };
  }
  const hist: IDateBin[] = [];

  if (max.getFullYear() - min.getFullYear() >= 2) {
    // more than two years difference
    const minYear = min.getFullYear();
    const maxYear = max.getFullYear();
    for (let i = minYear; i <= maxYear; ++i) {
      hist.push({
        x0: new Date(i, 0, 1),
        x1: new Date(i + 1, 0, 1),
        count: 0
      });
    }
    return { hist, histGranularity: "year" };
  }

  if (max.getTime() - min.getTime() <= 1000 * 60 * 60 * 24 * 31) {
    // less than a month use day
    let x0 = new Date(min.getFullYear(), min.getMonth(), min.getDate());
    while (x0 <= max) {
      const x1 = new Date(x0);
      x1.setDate(x1.getDate() + 1);
      hist.push({
        x0,
        x1,
        count: 0
      });
      x0 = x1;
    }
    return { hist, histGranularity: "day" };
  }
}

export function dateStatsBuilder(
  template?: IDateStatistics
): IBuilder<Date | null, IDateStatistics> {
  let min: Date | null = null;
  let max: Date | null = null;
  let count = 0;
  let missing = 0;

  // yyyymmdd, count
  const byDay = new Map<number, { x: Date; count: number }>();
  const templateHist = template
    ? template.hist.map((d) => ({ x0: d.x0, x1: d.x1, count: 0 }))
    : null;

  const push = (v: Date | null) => {
    count += 1;
    if (!v || v == null) {
      missing += 1;
      return;
    }
    if (min == null || v < min) {
      min = v;
    }
    if (max == null || v > max) {
      max = v;
    }
    if (templateHist) {
      pushDateHist(templateHist, v, 1);
      return;
    }
    const key = v.getFullYear() * 10000 + v.getMonth() * 100 + v.getDate();
    if (byDay.has(key)) {
      byDay.get(key)!.count++;
    } else {
      byDay.set(key, { count: 1, x: v });
    }
  };

  const build = () => {
    if (templateHist) {
      return {
        min,
        max,
        missing,
        count,
        maxBin: templateHist.reduce((acc, h) => Math.max(acc, h.count), 0),
        hist: templateHist,
        histGranularity: template!.histGranularity
      };
    }
    // copy template else derive
    const { histGranularity, hist } = computeGranularity(min, max);

    byDay.forEach((v) => pushDateHist(hist, v.x, v.count));

    return {
      min,
      max,
      missing,
      count,
      maxBin: hist.reduce((acc, h) => Math.max(acc, h.count), 0),
      hist,
      histGranularity
    };
  };

  return { push, build, pushAll: pushAll(push) };
}

export function round(v: number, precision: number = 0) {
  if (precision === 0) {
    return Math.round(v);
  }
  const scale = Math.pow(10, precision);
  return Math.round(v * scale) / scale;
}
