import {
  DEFAULT_COLOR,
  isMapAbleColumn,
  IImposer,
  IDataRow,
  Column,
  isMissingValue
} from "lineupjs";
import getStyle, {
  cssClass
} from "../../SmartSeparator/LineUpInternals/internalFunctions";
import { hsl } from "d3-color";

export function noop() {
  // no op
}

export const noRenderer = {
  template: `<div></div>`,
  update: noop
};

export function setText<T extends Node>(node: T, text?: string): T {
  if (text === undefined) {
    return node;
  }
  //no performance boost if setting the text node directly
  //const textNode = <Text>node.firstChild;
  //if (textNode == null) {
  //  node.appendChild(node.ownerDocument!.createTextNode(text));
  //} else {
  //  textNode.data = text;
  //}
  if (node.textContent !== text) {
    node.textContent = text;
  }
  return node;
}

export interface IForEachAble<T> extends Iterable<T> {
  forEach(callback: (v: T, i: number) => void): void;
}

export function isForEachAble<T>(
  v: IForEachAble<T> | any
): v is IForEachAble<T> {
  return typeof v.forEach === "function";
}

/**
 * generalized version of Array function similar to Scala ISeq
 */
export interface ISequence<T> extends IForEachAble<T> {
  readonly length: number;
  filter(callback: (v: T, i: number) => boolean): ISequence<T>;
  map<U>(callback: (v: T, i: number) => U): ISequence<U>;

  some(callback: (v: T, i: number) => boolean): boolean;
  every(callback: (v: T, i: number) => boolean): boolean;
  reduce<U>(callback: (acc: U, v: T, i: number) => U, initial: U): U;
}

export function isSeqEmpty(seq: ISequence<any>) {
  return seq.every(() => false); // more efficent than counting length
}

/**
 * helper function for faster access to avoid function calls
 */
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

export function colorOf(
  col: Column,
  row: IDataRow | null,
  imposer?: IImposer,
  valueHint?: number
) {
  if (imposer && imposer.color) {
    return imposer.color(row, valueHint);
  }
  if (!row) {
    if (isMapAbleColumn(col)) {
      return col.getColorMapping().apply(valueHint != null ? valueHint : 0);
    }
    return DEFAULT_COLOR;
  }
  return col.getColor(row);
}

export const GUESSED_ROW_HEIGHT = 18;
export const CANVAS_HEIGHT = 4;

export function renderMissingValue(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  x = 0,
  y = 0
) {
  const dashX = Math.max(0, x + (width - DASH.width) / 2); // center horizontally
  const dashY = Math.max(0, y + (height - DASH.height) / 2); // center vertically
  ctx.fillStyle = DASH.color;
  ctx.fillRect(
    dashX,
    dashY,
    Math.min(width, DASH.width),
    Math.min(height, DASH.height)
  );
}
export const DASH = {
  width: parseInt(getStyle("lu_missing_dash_width", "3px"), 10),
  height: parseInt(getStyle("lu_missing_dash_height", "10px"), 10),
  color: getStyle("lu_missing_dash_color", "gray")
};

export function renderMissingDOM(node: HTMLElement, col: Column, d: IDataRow) {
  const missing = isMissingValue(col.getValue(d));
  node.classList.toggle(cssClass("missing"), missing);
  return missing;
}

export function renderMissingCanvas(
  ctx: CanvasRenderingContext2D,
  col: Column,
  d: IDataRow,
  width: number,
  x = 0,
  y = 0
) {
  const missing = isMissingValue(col.getValue(d));
  if (missing) {
    renderMissingValue(ctx, width, CANVAS_HEIGHT, x, y);
  }
  return missing;
}
export const GUESSES_GROUP_HEIGHT = 40;

export function forEachChild<T extends Element>(
  node: Element,
  callback: (d: T, i: number) => void
) {
  (<T[]>Array.from(node.children)).forEach(callback);
}
