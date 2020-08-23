import { schemeCategory10, schemeSet3 } from "d3-scale-chromatic";
import {
  defaultGroup,
  IGroup,
  IGroupParent,
  IndicesArray,
  IOrderedGroup,
  IDateStatistics,
  IDateHistGranularity,
  IDateBin
} from "lineupjs";
import { OrderedSet } from "../../SmartSeparator/LineUpInternals/OrderedSet";
import { DEFAULT_COLOR } from "lineupjs";
import { similar } from "./mathInternals";
import { FIRST_IS_NAN, INumberFilter } from "lineupjs";

export function joinGroups(groups: IGroup[]): IGroup {
  if (groups.length === 0) {
    return { ...defaultGroup }; //copy
  }
  if (groups.length === 1 && !groups[0].parent) {
    return { ...groups[0] }; //copy
  }
  // create a chain
  const parents: IGroupParent[] = [];
  for (const group of groups) {
    const gparents: IGroupParent[] = [];
    let g = group;
    while (g.parent) {
      // add all parents of this groups
      gparents.unshift(g.parent);
      g = g.parent;
    }
    parents.push(...gparents);
    parents.push(Object.assign({ subGroups: [] }, group));
  }
  parents.slice(1).forEach((g, i) => {
    g.parent = parents[i];
    g.name = `${parents[i].name} ∩ ${g.name}`;
    g.color = g.color !== DEFAULT_COLOR ? g.color : g.parent.color;
    parents[i].subGroups = [g];
  });

  return parents[parents.length - 1];
}

export function duplicateGroup<T extends IOrderedGroup | IGroupParent>(
  group: T
) {
  const clone = <T>Object.assign({}, group);
  delete (<IOrderedGroup>clone).order;
  if (isGroupParent(<any>clone)) {
    (<any>clone).subGroups = [];
  }
  if (clone.parent) {
    clone.parent = duplicateGroup(clone.parent);
    clone.parent!.subGroups.push(clone);
  }
  return clone;
}

export function toGroupID(group: IGroup) {
  return group.name;
}

export function isOrderedGroup(
  g: IOrderedGroup | Readonly<IGroupParent>
): g is IOrderedGroup {
  return (<IOrderedGroup>g).order != null;
}

function isGroupParent(
  g: IOrderedGroup | Readonly<IGroupParent>
): g is IGroupParent {
  return (<IGroupParent>g).subGroups != null;
}

/**
 * unify the parents of the given groups by reusing the same group parent if possible
 * @param groups
 */
export function unifyParents<T extends IOrderedGroup>(groups: T[]) {
  if (groups.length <= 1) {
    return groups;
  }

  const toPath = (group: T) => {
    const path: (IGroupParent | T)[] = [group];
    let p = group.parent;
    while (p) {
      path.unshift(p);
      p = p.parent;
    }
    return path;
  };
  const paths = groups.map(toPath);

  const isSame = (a: IGroupParent, b: IGroupParent | T) => {
    return (
      b.name === a.name &&
      b.parent === a.parent &&
      isGroupParent(b) &&
      b.subGroups.length > 0
    );
  };

  const removeDuplicates = (level: (IGroupParent | T)[], i: number) => {
    const real: (IGroupParent | T)[] = [];
    while (level.length > 0) {
      const node = level.shift()!;
      if (!isGroupParent(node) || node.subGroups.length === 0) {
        // cannot share leaves
        real.push(node);
        continue;
      }
      const root = { ...node };
      real.push(root);
      // remove duplicates that directly follow
      while (level.length > 0 && isSame(root, level[0]!)) {
        root.subGroups.push(...(<IGroupParent>level.shift()!).subGroups);
      }
      for (const child of root.subGroups) {
        (<IGroupParent | T>child).parent = root;
      }
      // cleanup children duplicates
      root.subGroups = removeDuplicates(
        <(IGroupParent | T)[]>root.subGroups,
        i + 1
      );
    }
    return real;
  };

  removeDuplicates(
    paths.map((p) => p[0]),
    0
  );

  return groups;
}

export function groupRoots(groups: IOrderedGroup[]) {
  const roots = new OrderedSet<IOrderedGroup | Readonly<IGroupParent>>();
  for (const group of groups) {
    let root: IOrderedGroup | Readonly<IGroupParent> = group;
    while (root.parent) {
      root = root.parent;
    }
    roots.add(root);
  }
  return Array.from(roots);
}

// based on https://github.com/d3/d3-scale-chromatic#d3-scale-chromatic
const colors = schemeCategory10.concat(schemeSet3);

export const MAX_COLORS = colors.length;

export function colorPool() {
  let act = 0;
  return () => colors[act++ % colors.length];
}

export function mapIndices<T>(
  arr: IndicesArray,
  callback: (value: number, i: number) => T
): T[] {
  const r: T[] = [];
  for (let i = 0; i < arr.length; ++i) {
    r.push(callback(arr[i], i));
  }
  return r;
}

export function everyIndices(
  arr: IndicesArray,
  callback: (value: number, i: number) => boolean
): boolean {
  for (let i = 0; i < arr.length; ++i) {
    if (!callback(arr[i], i)) {
      return false;
    }
  }
  return true;
}

export function filterIndices(
  arr: IndicesArray,
  callback: (value: number, i: number) => boolean
): number[] {
  const r: number[] = [];
  for (let i = 0; i < arr.length; ++i) {
    if (callback(arr[i], i)) {
      r.push(arr[i]);
    }
  }
  return r;
}

export function forEachIndices(
  arr: IndicesArray,
  callback: (value: number, i: number) => void
) {
  for (let i = 0; i < arr.length; ++i) {
    callback(arr[i], i);
  }
}

/**
 * save number comparison
 * @param a
 * @param b
 * @param aMissing
 * @param bMissing
 * @return {number}
 */
export function numberCompare(
  a: number | null,
  b: number | null,
  aMissing = false,
  bMissing = false
) {
  aMissing = aMissing || a == null || isNaN(a);
  bMissing = bMissing || b == null || isNaN(b);
  if (aMissing) {
    //NaN are smaller
    return bMissing ? 0 : FIRST_IS_NAN;
  }
  if (bMissing) {
    return FIRST_IS_NAN * -1;
  }
  return a! - b!;
}

export function noNumberFilter() {
  return { min: -Infinity, max: Infinity, filterMissing: false };
}

export function isEqualNumberFilter(a: INumberFilter, b: INumberFilter) {
  return (
    similar(a.min, b.min, 0.001) &&
    similar(a.max, b.max, 0.001) &&
    a.filterMissing === b.filterMissing
  );
}

export function isNumberIncluded(filter: INumberFilter | null, value: number) {
  if (!filter) {
    return true;
  }
  if (isNaN(value)) {
    return !filter.filterMissing;
  }
  return !(
    (isFinite(filter.min) && value < filter.min) ||
    (isFinite(filter.max) && value > filter.max)
  );
}

export function isDummyNumberFilter(filter: INumberFilter) {
  return (
    !filter.filterMissing && !isFinite(filter.min) && !isFinite(filter.max)
  );
}

export function restoreNumberFilter(v: INumberFilter): INumberFilter {
  return {
    min: v.min != null && isFinite(v.min) ? v.min : -Infinity,
    max: v.max != null && isFinite(v.max) ? v.max : +Infinity,
    filterMissing: v.filterMissing
  };
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

  // by month
  let x0 = new Date(min.getFullYear(), min.getMonth(), 1);
  while (x0 <= max) {
    const x1 = new Date(x0);
    x1.setMonth(x1.getMonth() + 1);
    hist.push({
      x0,
      x1,
      count: 0
    });
    x0 = x1;
  }
  return { hist, histGranularity: "month" };
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
export function isIndicesAble<T>(
  it: Iterable<T>
): it is ArrayLike<T> & Iterable<T> {
  return (
    Array.isArray(it) ||
    it instanceof Uint8Array ||
    it instanceof Uint16Array ||
    it instanceof Uint32Array ||
    it instanceof Float32Array ||
    it instanceof Int8Array ||
    it instanceof Int16Array ||
    it instanceof Int32Array ||
    it instanceof Float64Array
  );
}

export interface IForEachAble<T> extends Iterable<T> {
  forEach(callback: (v: T, i: number) => void): void;
}

export function pushAll<T>(push: (v: T) => void) {
  return (vs: IForEachAble<T>) => {
    if (!isIndicesAble(vs)) {
      vs.forEach(push);
      return;
    }
    // tslint:disable-next-line:prefer-for-of
    for (let j = 0; j < vs.length; ++j) {
      push(vs[j]);
    }
  };
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
