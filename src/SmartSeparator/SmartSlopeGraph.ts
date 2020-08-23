import { IExceptionContext, ITableSection, range } from "lineupengine";
import * as d3 from "d3";
import {
  IGroupData,
  IGroupItem,
  IOrderedGroup,
  Ranking,
  IRankingHeaderContextContainer,
  EMode
} from "lineupjs";
import {
  cssClass,
  engineCssClass,
  SLOPEGRAPH_WIDTH,
  forEachIndices
} from "./LineUpInternals/internalFunctions";
import * as LineUpJS from "lineupjs";
import { EDrivingForce, ELocation, EScaleContext } from "./utils";

interface ISlope {
  isSelected(selection: { has(dataIndex: number): boolean }): boolean;

  update(
    path: SVGPathElement,
    width: number,
    start: number,
    location: ELocation,
    context: EDrivingForce
  ): void;

  readonly dataIndices: number[];
}

class ItemSlope implements ISlope {
  constructor(
    private readonly left: number,
    private readonly right: number,
    public readonly dataIndices: number[],
    private readonly location: string
  ) {}

  isSelected(selection: { has(dataIndex: number): boolean }) {
    return this.dataIndices.length === 1
      ? selection.has(this.dataIndices[0])
      : this.dataIndices.some((s) => selection.has(s));
  }

  update(
    path: SVGPathElement,
    width: number,
    start: number,
    location: ELocation,
    context: EDrivingForce
  ) {
    if (context === EDrivingForce.right) {
      const svg = d3
        .select("svg")
        .selectAll("g")
        .filter(function (d, i) {
          return i === 3;
        });

      var linkDataRight = [
        {
          source: {
            y: this.left,
            x: start
          },
          target: {
            y: this.right,
            x: width
          }
        }
      ];
      var linkRight = d3
        .linkHorizontal()
        .x(function (d) {
          return d["x"];
        })
        .y(function (d) {
          return d["y"];
        });
      svg
        .selectAll(null)
        .data(linkDataRight)
        .enter()
        .append("path")
        .attr("data-i", String(this.dataIndices[0]))
        .attr("class", cssClass("slope"))
        .attr("location", String(location))
        .attr("fill", "none")
        .attr("d", linkRight);
    } else if (context === EDrivingForce.left) {
      const svg2 = d3
        .select("svg")
        .selectAll("g")
        .filter(function (d, i, list) {
          return i === list.length - 1;
        });

      var linkDataLeft = [
        {
          source: {
            y: this.left,
            x: start
          },
          target: {
            y: this.right,
            x: width
          }
        }
      ];

      var linkLeft = d3
        .linkHorizontal()
        .x(function (d) {
          return d["x"];
        })
        .y(function (d) {
          return d["y"];
        });
      svg2
        .selectAll(null)
        .data(linkDataLeft)
        .enter()
        .append("path")
        .attr("data-i", String(this.dataIndices[0]))
        .attr("class", cssClass("slope"))
        .attr("location", String(location))
        .attr("fill", "none")
        .attr("d", linkLeft);
    }
  }
}

class BandSlope implements ISlope {
  constructor(
    private readonly left: number,
    private readonly leftNext: number,
    private readonly right: number,
    private readonly rightNext: number,
    public readonly dataIndices: number[],
    private readonly location: string
  ) {}

  isSelected(selection: { has(dataIndex: number): boolean }) {
    return this.dataIndices.length === 1
      ? selection.has(this.dataIndices[0])
      : this.dataIndices.some((s) => selection.has(s));
  }

  update(
    path: SVGPathElement,
    width: number,
    start: number,
    location: ELocation,
    context: EDrivingForce
  ) {
    path.setAttribute("data-i", String(this.dataIndices[0]));
    path.setAttribute("class", cssClass("slope"));
    path.setAttribute("location", String(location));
    path.setAttribute(
      "d",
      `M${start},${this.left}L${width},${this.right}L${start},${this.leftNext}L${start},${this.left}`
    );
  }
}

interface IPos {
  start: number;
  heightPerRow: number;
  rows: number[]; // data indices
  offset: number;
  ref: number[];
  group: IOrderedGroup;
}

export interface ISlopeGraphOptions {
  mode: EMode;
}

export class SmartSlopeGraph implements ITableSection {
  readonly node: SVGSVGElement;

  getSelectedIndicies: (dataIndex: number) => number | number[];

  private leftSlopes: ISlope[][] = [];
  // rendered row to one ore multiple slopes
  private rightSlopes: ISlope[][] = [];
  private readonly pool: SVGPathElement[] = [];

  private scrollListener:
    | ((act: { top: number; height: number }) => void)
    | null = null;

  readonly width = SLOPEGRAPH_WIDTH;
  readonly height = 0;

  private current: {
    rootRanking: Ranking;
    root: (IGroupItem | IGroupData)[];
    rootContext: IExceptionContext;
    dependentRanking: Ranking;
    dependent: (IGroupItem | IGroupData)[];
    dependentContext: IExceptionContext;
  } | null = null;

  private chosen = new Set<ISlope>();
  private chosenSelectionOnly = new Set<ISlope>();

  private _mode: EMode = EMode.ITEM;

  private instances;
  private mappingResolver;
  private xScale;
  private drivingRanking;
  private scaleContext;

  constructor(
    public readonly header: HTMLElement,
    public readonly body: HTMLElement,
    public readonly id: string,
    private readonly ctx: IRankingHeaderContextContainer,
    options: Partial<ISlopeGraphOptions> = {},
    instances: LineUpJS.LineUp[],
    mappingResolver: (
      selection: number[],
      reverse: boolean
    ) => number | Number[],
    xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>,
    drivingRanking: ELocation
  ) {
    d3.select("svg").append("g").attr("transform", `translate(0,0)`);
    body.classList.add(cssClass("slopegraph"));
    this.body.style.height = `200px`;
    this.instances = instances;
    this.mappingResolver = mappingResolver;
    this.xScale = xScale;

    // determine type of scale and set globally
    if (this.xScale.domain()[0] instanceof Date) {
      this.scaleContext = EScaleContext.time;
    } else {
      this.scaleContext = EScaleContext.genome;
    }

    this.drivingRanking = drivingRanking;
  }

  init() {
    this.hide(); // hide by default
    const scroller = <any>this.body.parentElement!;

    //sync scrolling of header and body
    // use internals from lineup engine
    const scroll = (<any>scroller).__le_scroller__;
    let old: { top: number; height: number } = scroll.asInfo();
    scroll.push(
      "animation",
      (this.scrollListener = (act: { top: number; height: number }) => {
        if (Math.abs(old.top - act.top) < 5) {
          return;
        }
        old = act;
        this.onScrolledVertically(act.top, act.height);
      })
    );
  }

  get mode() {
    return this._mode;
  }

  set mode(value: EMode) {
    if (value === this._mode) {
      return;
    }
    this._mode = value;
    if (this.current) {
      this.rebuild(
        this.current.rootRanking,
        this.current.root,
        this.current.rootContext,
        this.current.dependentRanking,
        this.current.dependent,
        this.current.dependentContext
      );
    }
  }

  get hidden() {
    return this.header.classList.contains(engineCssClass("loading"));
  }

  set hidden(value: boolean) {
    this.header.classList.toggle(engineCssClass("loading"), value);
    this.body.classList.toggle(engineCssClass("loading"), value);
  }

  hide() {
    this.hidden = true;
  }

  show() {
    const was = this.hidden;
    this.hidden = false;
    if (was) {
      this.revalidate();
    }
  }

  destroy() {
    this.header.remove();
    if (this.scrollListener) {
      //sync scrolling of header and body
      // use internals from lineup engine
      const scroll = (<any>this.body.parentElement!).__le_scroller__;
      scroll.remove(this.scrollListener);
    }
    this.body.remove();
  }

  /**
   *  rebuilds slope graph
   * @param {Ranking} rootRanking
   * @param {(IGroupItem | IGroupData)[]} root
   * @param {IExceptionContext} rootContext
   * @param {Ranking} dependentRanking
   * @param {(IGroupItem | IGroupData)[]} dependent
   * @param {IExceptionContext} dependentContext
   */
  rebuild(
    rootRanking: Ranking,
    root: (IGroupItem | IGroupData)[],
    rootContext: IExceptionContext,
    dependentRanking: Ranking,
    dependent: (IGroupItem | IGroupData)[],
    dependentContext: IExceptionContext
  ) {
    this.current = {
      rootRanking,
      root,
      rootContext,
      dependentRanking,
      dependent,
      dependentContext
    };

    // get lookup for positions of items in both rankings
    const rootLookup: Map<number, IPos> = this.prepareOuterSlopes(
      root,
      rootContext
    );
    const dependentLookup: Map<number, IPos> = this.prepareOuterSlopes(
      dependent,
      dependentContext
    );

    const rootSlopeLocation =
      this.drivingRanking === EDrivingForce.left
        ? ELocation.left
        : ELocation.right;
    const dependentSlopeLocation =
      this.drivingRanking === EDrivingForce.left
        ? ELocation.right
        : ELocation.left;

    // compute slopes with lookup for both sides of the scale
    this.computeSlopes(
      dependent,
      dependentContext,
      dependentLookup,
      dependentSlopeLocation
    );
    this.computeSlopes(root, rootContext, rootLookup, rootSlopeLocation);
    this.revalidate();
  }

  /**
   *  computes slopes between the scale and the items of a given ranking
   * @param {(IGroupItem | IGroupData)[]} ranking
   * @param {IExceptionContext} context
   * @param {Map<number, IPos>} lookup
   * @param {string} location
   * @returns {ISlope[]}
   */
  private computeSlopes(
    ranking: (IGroupItem | IGroupData)[],
    context: IExceptionContext,
    lookup: Map<number, IPos>,
    location: string
  ) {
    let acc = 0;
    let accNext = 0;
    // iterate through root slopes
    this.leftSlopes = ranking.map((r, i, array) => {
      let height = context.exceptionsLookup.get(i) || context.defaultRowHeight;
      let heightNext =
        context.exceptionsLookup.get(i + 1) || context.defaultRowHeight;

      let padded = height - 0; //leftContext.padding(i);
      let paddedNext = heightNext - 0; //leftContext.padding(i);

      const resultSlopes = <ISlope[]>[];
      const start = acc;
      const startNext = accNext;
      // shift by item height
      acc += height;
      accNext += heightNext;
      let offset = 0;

      const push = (s: ISlope, right: IPos, common = 1, heightPerRow = 0) => {
        // store slope in both
        resultSlopes.push(s);
        forEachIndices(right.ref, (r) => {
          if (this.rightSlopes[r].length === 0) {
            this.rightSlopes[r].push(s);
          }
        });

        // update the offset of myself and of the right side
        right.offset += common * right.heightPerRow;
        offset += common * heightPerRow;
      };

      const item = <IGroupItem>r;
      const dataIndex = item.dataIndex;
      const dataIndexNext = item.dataIndex + 1;

      let mappingResult;
      if (location === ELocation.left) {
        mappingResult = this.mappingResolver([dataIndex], false);
      } else {
        mappingResult = dataIndex;
      }

      // current root row
      const right = lookup.get(dataIndex);

      if (!right) {
        // no match
        return resultSlopes;
      }

      let positionOnScale;
      let positionOnScaleNext;
      if (location === ELocation.left) {
        // separate by scale context and get position on scale
        if (this.scaleContext === EScaleContext.time) {
          const getDateFromRanking = this.current.dependentContext.columns[
            this.current.dependentContext.columns.length - 1
          ].ctx.tasks.data[dataIndex].v["Date"];
          positionOnScale = this.xScale(new Date(getDateFromRanking));
          positionOnScaleNext = this.xScale(
            d3.timeMonth.offset(new Date(getDateFromRanking), 1)
          );
        } else {
          // offset is required to retrieve correct index
          positionOnScale = this.xScale(dataIndex + 1);
          positionOnScaleNext = this.xScale(dataIndex + 2);
        }
      } else {
        if (this.scaleContext === EScaleContext.time) {
          const getDateFromRanking = this.current.rootContext.columns[
            this.current.rootContext.columns.length - 1
          ].ctx.tasks.data[dataIndex].v["Date"];
          positionOnScale = this.xScale(new Date(getDateFromRanking));
          positionOnScaleNext = this.xScale(
            d3.timeMonth.offset(new Date(getDateFromRanking), 1)
          );
        } else {
          const mappingResult = this.mappingResolver(dataIndex, true);
          // offset is required to retrieve correct index
          positionOnScale = this.xScale(mappingResult + 1);
          positionOnScaleNext = this.xScale(mappingResult + 2);
        }
      }
      const scaleOffset = 10;

      // initialize slopes
      if (location === ELocation.left) {
        const s = new ItemSlope(
          start + padded / 2,
          positionOnScale + scaleOffset,
          [dataIndex],
          ELocation.left
        );
        push(s, right);
      } else {
        if (this.scaleContext === EScaleContext.time) {
          const s = new BandSlope(
            positionOnScale + scaleOffset,
            positionOnScaleNext + scaleOffset,
            start + padded / 2,
            startNext + paddedNext / 2,
            [dataIndex, dataIndexNext],
            ELocation.right
          );
          push(s, right);
        } else if (this.scaleContext === EScaleContext.genome) {
          const s = new ItemSlope(
            positionOnScale + scaleOffset,
            start + padded / 2,
            [dataIndex],
            ELocation.right
          );
          push(s, right);
        }
      }
      return resultSlopes;
    });
  }

  /**
   *  calculates lookup map for outer rankings including position of each row
   * @param {(IGroupItem | IGroupData)[]} dependent
   * @param {IExceptionContext} dependentContext
   * @returns {Map<number, IPos>}
   */
  private prepareOuterSlopes(
    ranking: (IGroupItem | IGroupData)[],
    rankingContext: IExceptionContext
  ) {
    const lookup = new Map<number, IPos>();
    const mode = this.mode;

    const fakeGroups = new Map<IOrderedGroup, IPos>();
    let acc = 0;

    this.rightSlopes = ranking.map((r, i) => {
      const height =
        rankingContext.exceptionsLookup.get(i) ||
        rankingContext.defaultRowHeight;
      const padded = height - 0; //rightContext.padding(i);
      let start = acc;
      acc += height;
      const slopes = <ISlope[]>[];

      const base = {
        start,
        offset: 0,
        ref: [i]
      };
      // item
      const item = <IGroupItem>r;
      const dataIndex = r.dataIndex;

      let p = Object.assign(base, {
        rows: [dataIndex],
        heightPerRow: padded,
        group: item.group
      });

      if (mode === EMode.ITEM) {
        lookup.set(dataIndex, p);
        return slopes;
      }
      // forced band mode
      // merge with the 'ueber' band
      if (!fakeGroups.has(item.group)) {
        p.heightPerRow = height; // include padding
        fakeGroups.set(item.group, p);
      } else {
        p = fakeGroups.get(item.group)!;
        p.rows.push(dataIndex);
        p.ref.push(i);
      }
      lookup.set(dataIndex, p);
      return slopes;
    });
    return lookup;
  }

  private revalidate() {
    if (!this.current || this.hidden) {
      return;
    }
    const p = this.body.parentElement!;
    this.onScrolledVertically(p.scrollTop, p.clientHeight);
  }

  highlight(dataIndex: number) {
    const highlight = engineCssClass("highlighted");
    const old = this.body.querySelector(`[data-i].${highlight}`);
    if (old) {
      old.classList.remove(highlight);
    }
    if (dataIndex < 0) {
      return;
    }
    const item = this.body.querySelector(`[data-i="${dataIndex}"]`);
    if (item) {
      item.classList.add(highlight);
    }
    return item != null;
  }

  private onScrolledVertically(scrollTop: number, clientHeight: number) {
    if (!this.current) {
      return;
    }

    // which lines are currently shown
    const { rootContext, dependentContext } = this.current;
    const left = range(
      scrollTop,
      clientHeight,
      rootContext.defaultRowHeight,
      rootContext.exceptions,
      rootContext.numberOfRows
    );
    const right = range(
      scrollTop,
      clientHeight,
      dependentContext.defaultRowHeight,
      dependentContext.exceptions,
      dependentContext.numberOfRows
    );

    const start = Math.min(left.firstRowPos, right.firstRowPos);
    const end = Math.max(left.endPos, right.endPos);

    // move to right position
    this.body.style.transform = `translate(0, ${start.toFixed(0)}px)`;
    this.body.style.height = `${(end - start).toFixed(0)}px`;
    this.body.firstElementChild.children[1].setAttribute(
      "transform",
      `translate(0,-${start.toFixed(0)})`
    );
    this.chosen = this.choose(left.first, left.last, right.first, right.last);
    this.render(
      this.chosen,
      this.chooseSelection(left.first, left.last, this.chosen)
    );
  }

  private choose(
    leftVisibleFirst: number,
    leftVisibleLast: number,
    rightVisibleFirst: number,
    rightVisibleLast: number
  ) {
    // assume no separate scrolling
    const slopes = new Set<ISlope>();
    if (this.leftSlopes.length > 0) {
      for (let i = leftVisibleFirst; i <= leftVisibleLast; ++i) {
        for (const s of this.leftSlopes[i]) {
          slopes.add(s);
        }
      }
    }
    if (this.rightSlopes.length > 0) {
      for (let i = rightVisibleFirst; i <= rightVisibleLast; ++i) {
        for (const s of this.rightSlopes[i]) {
          slopes.add(s);
        }
      }
    }
    return slopes;
  }
  // does not bother us for selections
  private chooseSelection(
    leftVisibleFirst: number,
    leftVisibleLast: number,
    alreadyVisible: Set<ISlope>
  ) {
    const slopes = new Set<ISlope>();
    // ensure selected slopes are always part of
    const p = this.ctx.provider;

    if (p.getSelection().length === 0) {
      return slopes;
    }
    const selectionLookupA = {
      has: (dataIndex: number) => p.isSelected(dataIndex)
    };

    // try all not visible ones
    for (let i = 0; i < leftVisibleFirst; ++i) {
      for (const s of this.leftSlopes[i]) {
        if (s.isSelected(selectionLookupA) && !alreadyVisible.has(s)) {
          slopes.add(s);
        }
      }
    }
    for (let i = leftVisibleLast + 1; i < this.leftSlopes.length; ++i) {
      for (const s of this.leftSlopes[i]) {
        if (s.isSelected(selectionLookupA) && !alreadyVisible.has(s)) {
          slopes.add(s);
        }
      }
    }
    return slopes;
  }

  /**
   *  update all slopes
   * @param {any} path
   * @param {SVGPathElement} p
   * @param {SVGGElement} g
   * @param {ISlope} s
   * @param {number} width
   * @param {number} start
   * @param {{ has(dataIndex: number): boolean }} selection
   */
  private updatePath(
    paths: any,
    p: SVGPathElement,
    g: SVGGElement,
    s: ISlope,
    width: number,
    start: number,
    selection: { has(dataIndex: number): boolean }
  ) {
    // calculate width and start for slopes
    if (s["location"] === ELocation.right) {
      const svgLength = document
        .getElementsByTagName("svg")[0]
        .getBoundingClientRect().width;

      const gLeft = document
        .getElementsByTagName("g")[0]
        .getBoundingClientRect().left;

      const svgLeft = document
        .getElementsByTagName("svg")[0]
        .getBoundingClientRect().left;

      const half = document
        .getElementsByClassName("domain")[0]
        .getBoundingClientRect().width;

      width = svgLength;
      start = gLeft - svgLeft + half;
    }
    if (width > 100) {
      const half = document
        .getElementsByClassName("domain")[0]
        .getBoundingClientRect().width;
      width =
        width -
        document.getElementsByClassName("domain")[0].getBoundingClientRect()
          .width;
      if (s["location"] === ELocation.right) {
        start = start + half;
      }
    }
    s.update(p, width, start, s["location"], this.drivingRanking);

    (<any>p).__data__ = s; // data binding
    const selected = s.isSelected(selection);

    // split into slopes on right/left side of scale
    let currentRightSlopes = [];
    let currentLeftSlopes = [];

    Array.from(d3.selectAll(".lu-slope")._groups[0]).forEach((v: Element) => {
      if (String(v.getAttribute("location")) === ELocation.left) {
        currentLeftSlopes.push(v);
      } else if (String(v.getAttribute("location")) === ELocation.right) {
        currentRightSlopes.push(v);
      }
    });
    // highlight path originating from the selected item
    if (this.drivingRanking === EDrivingForce.left && selected) {
      const counterpart = this.mappingResolver(s["dataIndices"], false);
      let counterPartArray = [];
      if (counterpart.length !== undefined) {
        counterpart.forEach((val) => {
          counterPartArray.push(val);
        });
      } else {
        counterPartArray.push(counterpart);
      }
      currentLeftSlopes.forEach((slope) => {
        if (Number(slope.getAttribute("data-i")) === s["dataIndices"][0]) {
          d3.select(slope).attr("class", "lu-slope lu-selected");
        }
      });
      currentRightSlopes.forEach((slope) => {
        if (
          Number(slope.getAttribute("data-i")) === Number(counterPartArray[0])
        ) {
          d3.select(slope).attr("class", "lu-slope lu-selected");
        }
      });
    } else if (this.drivingRanking === EDrivingForce.right && selected) {
      currentRightSlopes.forEach((slope) => {
        if (Number(slope.getAttribute("data-i")) === s["dataIndices"][0]) {
          slope.classList.toggle(cssClass("selected"), selected);
          slope.setAttribute("fill", "#ffa500");
        }
      });
    }
  }

  private render(visible: Set<ISlope>, selectionSlopes: Set<ISlope>) {
    const g = <SVGGElement>this.body.firstElementChild.children[1];
    const svgLength = document
      .getElementsByTagName("svg")[0]
      .getBoundingClientRect().right;

    const gLeft = document.getElementsByTagName("g")[0].getBoundingClientRect()
      .left;

    const half = document
      .getElementsByClassName("domain")[0]
      .getBoundingClientRect().width;

    const width = svgLength - gLeft - half;
    const start = 0;
    const paths = this.matchLength(visible.size + selectionSlopes.size, g);

    const p = this.instances[0].renderer.ctx.provider;

    const selectionLookup = {
      has: (dataIndex: number) => p.isSelected(dataIndex)
    };

    // update paths
    let i = 0;

    const updatePath = (s: ISlope) => {
      this.updatePath(paths, paths[i++], g, s, width, start, selectionLookup);
    };

    visible.forEach(updatePath);
    selectionSlopes.forEach(updatePath);

    // select counterpart
    if (this.drivingRanking === EDrivingForce.left) {
      Array.from(d3.selectAll(".lu-slope")._groups[0]).forEach((slope: Element, i) => {
        const mapping = this.mappingResolver(
          this.instances[0].getSelection(),
          false
        );
        const mappingAsArray = [];
        if (mapping.length !== undefined) {
          mapping.forEach((val) => {
            mappingAsArray.push(val);
          });
        } else {
          mappingAsArray.push(mapping);
        }

        if (
          slope.getAttribute("location") === ELocation.right &&
          mappingAsArray.includes(Number(slope.getAttribute("data-i")))
        ) {
          slope.setAttribute("class", "lu-slope lu-selected");
        }
      });
    } else if (this.drivingRanking === EDrivingForce.right) {
      Array.from(d3.selectAll(".lu-slope")._groups[0]).forEach((slope: Element, i) => {
        const mapping =
          this.instances[1].getSelection().length > 0
            ? this.mappingResolver(this.instances[1].getSelection(), true)
            : this.instances[1].getSelection();
        const mappingAsArray = [];
        if (mapping.length !== undefined) {
          mapping.forEach((val) => {
            mappingAsArray.push(val);
          });
        } else {
          mappingAsArray.push(mapping);
        }

        if (
          slope.getAttribute("location") === ELocation.left &&
          mappingAsArray.includes(Number(slope.getAttribute("data-i")))
        ) {
          slope.setAttribute("class", "lu-slope lu-selected");
        }
      });
    }
  }

  private addPath(g: SVGGElement) {
    const elem = this.pool.pop();
    if (elem) {
      g.appendChild(elem);
      return elem;
    }

    const path = g.ownerDocument!.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    path.onclick = (evt) => {
      // d3 style
      const s: ISlope = (<any>path).__data__;
      const p = this.ctx.provider;
      const ids = this.mappingResolver(s.dataIndices, false);
      if (evt.ctrlKey) {
        ids.forEach((id) => p.toggleSelection(id));
      } else {
        // either unset or set depending on the first state
        const isSelectedA = p.isSelected(ids[0]!);
        p.setSelection(isSelectedA ? [] : ids);
      }
    };
    g.appendChild(path);
    return path;
  }

  private matchLength(slopes: number, g: SVGGElement) {
    const paths = <SVGPathElement[]>Array.from(g.children);
    for (let i = slopes; i < paths.length; ++i) {
      const elem = paths[i];
      this.pool.push(elem);
      elem.remove();
    }

    for (let i = paths.length; i < slopes; ++i) {
      paths.push(this.addPath(g));
    }
    return paths;
  }

  updateSelection(selectedDataIndices: Set<number>) {
    const g = <SVGGElement>this.node.firstElementChild!;
    const paths = <SVGPathElement[]>Array.from(g.children);

    const openDataIndices = new Set(selectedDataIndices);

    if (selectedDataIndices.size === 0) {
      // clear
      for (const p of paths) {
        const s: ISlope = (<any>p).__data__;
        p.classList.toggle(cssClass("selected"), false);
        if (this.chosenSelectionOnly.has(s)) {
          p.remove();
        }
      }
      this.chosenSelectionOnly.clear();
      return;
    }

    for (const p of paths) {
      const s: ISlope = (<any>p).__data__;
      const selected = s.isSelected(selectedDataIndices);
      p.classList.toggle(cssClass("selected"), selected);
      if (!selected) {
        if (this.chosenSelectionOnly.delete(s)) {
          // was only needed because of the selection
          p.remove();
        }
        continue;
      }

      // remove already handled
      s.dataIndices.forEach((d) => openDataIndices.delete(d));
    }

    if (openDataIndices.size === 0) {
      return;
    }

    // find and add missing slopes
    const width = document
      .getElementsByTagName("svg")[0]
      .getBoundingClientRect().width;

    for (const ss of this.leftSlopes) {
      for (const s of ss) {
        if (
          this.chosen.has(s) ||
          this.chosenSelectionOnly.has(s) ||
          !s.isSelected(openDataIndices)
        ) {
          // not visible or not selected -> skip
          continue;
        }
        // create new path for it
        this.chosenSelectionOnly.add(s);
        const p = this.addPath(g);
        this.updatePath(paths, p, g, s, width, 0, openDataIndices);
      }
    }
  }
}
