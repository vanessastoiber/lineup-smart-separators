import {
  Column,
  isNumbersColumn,
  IDataRow,
  INumberColumn,
  isNumberColumn,
  DEFAULT_COLOR
} from "lineupjs";

import {
  IRenderContext,
  ERenderMode,
  ICellRendererFactory,
  IImposer,
  IGroupCellRenderer,
  ISummaryRenderer,
  ICellRenderer
} from "lineupjs";
import {
  renderMissingCanvas,
  renderMissingDOM
} from "./LineUpInternalsTime/internals";
import { noRenderer, setText } from "./LineUpInternalsTime/internals";
import {
  cssClass,
  CANVAS_HEIGHT
} from "../SmartSeparator/LineUpInternals/internalFunctions";
import { round } from "./LineUpInternalsTime/mathInternals";

export default class TimeColumnRenderer implements ICellRendererFactory {
  readonly title: string = "TimeColumn";

  /**
   * flag to always render the value
   * @type {boolean}
   */

  constructor(private readonly renderValue: boolean = false) {}

  canRender(col: Column, mode: ERenderMode): boolean {
    return (
      mode === ERenderMode.CELL && isNumberColumn(col) && !isNumbersColumn(col)
    );
  }

  create(
    col: INumberColumn,
    context: IRenderContext,
    imposer?: IImposer
  ): ICellRenderer {
    const width = context.colWidth(col);
    return {
      template: `<div title="">
          <div class="${cssClass(
            "bar-label"
          )}" style='background-color: ${DEFAULT_COLOR}'>
            <span ${
              this.renderValue ? "" : `class="${cssClass("hover-only")}"`
            }></span>
          </div>
        </div>`,
      update: (n: HTMLDivElement, d: IDataRow) => {
        const value = col.getNumber(d);
        const missing = renderMissingDOM(n, col, d);
        const w = isNaN(value) ? 0 : round(value * 100, 2);
        const title = col.getLabel(d);
        n.title = title;

        const bar = <HTMLElement>n.firstElementChild!;

        bar.style.width = missing ? "100%" : `${w}%`;
        bar.style.backgroundColor = "";
        bar.style.borderRight = "1.5px solid black";
        setText(bar.firstElementChild!, title);
        const item = <HTMLElement>bar.firstElementChild!;
        setText(item, title);
      },
      render: (ctx: CanvasRenderingContext2D, d: IDataRow) => {
        if (renderMissingCanvas(ctx, col, d, width)) {
          return;
        }
        const value = col.getNumber(d);
        const w = width * value;
        ctx.fillRect(0, 0, isNaN(w) ? 0 : w, CANVAS_HEIGHT);
      }
    };
  }

  createGroup(): IGroupCellRenderer {
    return noRenderer;
  }

  createSummary(): ISummaryRenderer {
    return noRenderer;
  }
}
