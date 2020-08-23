import { IDataRow, ActionColumn, Column, HierarchyColumn } from "lineupjs";
import {
  IRenderContext,
  ERenderMode,
  ICellRendererFactory,
  ICellRenderer,
  IGroupCellRenderer,
  ISummaryRenderer
} from "lineupjs";
import { renderMissingDOM } from "./LineUpInternalsTime/internals";
import { noRenderer, setText } from "./LineUpInternalsTime/internals";
import { cssClass } from "../SmartSeparator/LineUpInternals/internalFunctions";

export default class HierarchyLevelCellRenderer
  implements ICellRendererFactory {
  readonly title = "HierarchyLevel";

  canRender(col: Column, mode: ERenderMode): boolean {
    return col instanceof HierarchyColumn && mode === ERenderMode.CELL;
  }

  create(col: HierarchyColumn): ICellRenderer {
    const align = "left";
    return {
      template: `<div${
        align !== "left" ? ` class="${cssClass(align)}"` : ""
      }> </div>`,
      update: (n: HTMLDivElement, d: IDataRow) => {
        renderMissingDOM(n, col, d);
        if (col) {
          const label = col.getLabel(d);
          const test = label.slice(label.lastIndexOf(".") + 1);
          const limit = test.length;
          const head = label.slice(0, -limit);
          const tail = label.slice(-limit);

          setText(
            n,
            head.replace(/./g, "_").substring(0, head.length / 3) + tail
          );
        } else {
          n.innerHTML = col.getLabel(d);
        }
        n.title = n.textContent!;
      }
    };
  }

  createGroup(col: ActionColumn, context: IRenderContext): IGroupCellRenderer {
    return noRenderer;
  }

  createSummary(): ISummaryRenderer {
    return noRenderer;
  }
}
