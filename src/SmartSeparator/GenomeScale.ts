import { EMode, EngineRanking, Ranking } from "lineupjs";
import { SmartSlopeGraph } from "./SmartSlopeGraph";
import {
  cssClass,
  aria,
  engineCssClass
} from "../SmartSeparator/LineUpInternals/internalFunctions";
import * as d3 from "d3";
import * as LineUpJS from "lineupjs";
import { EDrivingForce, EActions } from "./utils";
import * as NMmappingData from "../../data/genes-proteins/mapping.json";
const mappingData = Object.assign([], NMmappingData);

export class GenomeScale {
  private firstLineUpInstance: LineUpJS.LineUp;
  private secondLineUpInstance: LineUpJS.LineUp;
  private element: HTMLElement = document.getElementById("mapping");
  private drivingRanking: EDrivingForce;

  private _mode: EMode = EMode.ITEM;

  constructor(
    firstLineUpInstance: LineUpJS.LineUp,
    secondLineUpInstance: LineUpJS.LineUp,
    drivingRanking: EDrivingForce = EDrivingForce.left
  ) {
    this.firstLineUpInstance = firstLineUpInstance;
    this.secondLineUpInstance = secondLineUpInstance;
    this.drivingRanking = drivingRanking;
  }

  /**
   *  lookup function to count the occurences of an index in the mapping in order to detect N:M relationships
   * @param {number[]} value Selection of the ranking
   * @param {boolean} reverse Mapping from left to right or in reverse order
   * @returns {number | Number[]}
   */
  static countOccurences = (value: number[], reverse: boolean): number => {
    const direction = reverse ? 1 : 0;
    let counter: number = 0;
    mappingData.forEach((elem) => {
      if (elem[direction] === value[0]) {
        counter += 1;
      }
    });
    return counter;
  };

  static updateDone = false;
  /**
   *  lookup function to get idtype mapping
   * @param {number[]} selection Selection of the ranking
   * @param {boolean} reverse Mapping from left to right or in reverse order
   * @returns {number | number[]}
   */
  static mappingResolverLookup = (
    selection: number | number[],
    reverse: boolean
  ): number[] => {
    const i = reverse ? 1 : 0;
    const ret = i === 1 ? 0 : 1;
    if (!Array.isArray(selection)) {
      selection = [selection];
    }
    // check if first number exists in data
    if (mappingData.find((x) => x[i] === selection[0]) !== undefined) {
      // multiple selected
      if (selection.length > 1) {
        const matchingIndices: number[] = [];
        selection.forEach((element: number) => {
          if (
            mappingData !== undefined &&
            mappingData.find((x) => x[i] === element) !== undefined
          ) {
            matchingIndices.push(
              mappingData.find((x) => x[i] === element)![ret]
            );
          }
        });
        return matchingIndices;
      } else if (GenomeScale.countOccurences(selection, reverse) > 1) {
        // n:m cases
        const matchingIndices: number[] = [];
        mappingData.forEach((elem) => {
          if (elem[i] === selection[0]) {
            matchingIndices.push(elem[ret]);
          }
        });
        return matchingIndices;
      } else {
        // single selection
        return mappingData.find((x) => x[i] === selection[0])![ret];
      }
    } else {
      return selection;
    }
  };

  init() {
    const instanceA = this.firstLineUpInstance;
    const instanceB = this.secondLineUpInstance;

    const mappingElement: HTMLElement[] = this.prepareMappingElement(
      this.element
    );

    const rootInstance = this.drivingRanking === "left" ? instanceA : instanceB;
    const dependentInstance =
      rootInstance === instanceA ? instanceB : instanceA;

    // calculate min and max value from union of both available datasets

    const htmlIndex = this.drivingRanking === EDrivingForce.left ? 1 : 3;

    const bodies = document.getElementsByTagName("main");
    const positionInfoBody = bodies
      .item(htmlIndex)
      .getElementsByTagName("article")[0]
      .getBoundingClientRect();
    const bodyHeight = positionInfoBody.height;
    const bodyWidth = positionInfoBody.width;
    var width = bodyWidth;
    var height = 400;

    const svg = d3
      .select("#mapping-body")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // create linear scale
    var scale = d3
      .scaleLinear()
      .range([0, bodyHeight + 200])
      .domain([1, rootInstance._data._dataRows.length]);

    // Add scales to axis
    const axis = svg
      .append("g")
      .attr("transform", `translate(100,10)`)
      .attr("visibility", "hidden")
      .call(d3.axisRight(scale).tickSize(0).tickFormat(""));

    // initialize slope graph
    const independentSlope = new SmartSlopeGraph(
      mappingElement[0],
      mappingElement[1],
      `${document.getElementById("mapping").id}S`,
      (rootInstance as any).renderer.rankings[0].ctx,
      {
        mode: LineUpJS.EMode.ITEM
      },
      [rootInstance, dependentInstance],
      GenomeScale.mappingResolverLookup,
      scale,
      this.drivingRanking
    );

    const rankingsForUpdate: EngineRanking[] = [];
    rankingsForUpdate.push((rootInstance as any).renderer.rankings[0]);
    rankingsForUpdate.push((dependentInstance as any).renderer.rankings[0]);

    GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);

    let isUpdated = false;

    rootInstance.on(LineUpJS.LineUp.EVENT_SELECTION_CHANGED, function (
      selectedIndicies
    ) {
      GenomeScale.handleSelectionChanged(
        dependentInstance,
        selectedIndicies,
        GenomeScale.updateDone
      );
      GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
    });

    dependentInstance.on(LineUpJS.LineUp.EVENT_SELECTION_CHANGED, function (
      selectedIndicies
    ) {
      GenomeScale.handleSelectionChangedMapping(
        rootInstance,
        selectedIndicies,
        GenomeScale.updateDone
      );
      GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
    });

    // Rerender slopes in case sorting changes
    const rankA: EngineRanking = (instanceA as any).renderer.rankings[0]
      .ranking;
    rankA.on(Ranking.EVENT_SORT_CRITERIA_CHANGED, (old, updated) => {
      if (old.length === updated.length) {
        if (old[0]["asc"] !== updated[0]["asc"]) {
          GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
        } else {
          return;
        }
      } else if (old.length === 0 || updated.length === 0) {
        GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
      } else {
        GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
      }
    });
    const rankB: EngineRanking = (instanceB as any).renderer.rankings[0]
      .ranking;
    rankB.on(Ranking.EVENT_SORT_CRITERIA_CHANGED, (old, updated) => {
      if (old.length === updated.length) {
        if (old[0]["asc"] !== updated[0]["asc"]) {
          GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
        } else {
          return;
        }
      } else if (old.length === 0 || updated.length === 0) {
        GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
      } else {
        GenomeScale.renderSlopes(independentSlope, rankingsForUpdate);
      }
    });
  }

  /**
   *  function that handles selection changed event on rootInstance
   * @param {LineUpJS.LineUp} dependentInstance
   * @param {d3.Selection<SVGCircleElement, unknown, null, undefined>} relatedCircle
   * @param {number[]} selectedIndicies
   */
  static handleSelectionChanged(
    dependentInstance: LineUpJS.LineUp,
    selectedIndicies: number[],
    isUpdated: boolean
  ) {
    let action: EActions = EActions.select;
    if (selectedIndicies.length === 0) {
      action = EActions.remove;
    }
    const mappingResult = this.mappingResolverLookup(selectedIndicies, false);

    const mappingResultArray = [];
    if (mappingResult.length !== undefined) {
      mappingResult.forEach((res) => {
        mappingResultArray.push(res);
      });
    } else {
      mappingResultArray.push(mappingResult);
    }
    if (isUpdated) {
      return;
    }

    if (dependentInstance.getSelection() !== mappingResult) {
      GenomeScale.updateDone = true;
      dependentInstance.setSelection(mappingResultArray);
      GenomeScale.updateDone = false;
    }
  }

  /**
   *  function that handles selection changed event on dependentInstance
   * @param {LineUpJS.LineUp} rootInstance
   * @param {number[]} selectedIndicies
   * @param {boolean} isUpdated
   */
  static handleSelectionChangedMapping(
    rootInstance: LineUpJS.LineUp,
    selectedIndicies: number[],
    isUpdated: boolean
  ) {
    let action: EActions = EActions.select;
    if (selectedIndicies.length === 0) {
      action = EActions.remove;
    }

    const mappingResult = this.mappingResolverLookup(selectedIndicies, true);

    if (isUpdated) {
      return;
    }

    if (rootInstance.getSelection() !== mappingResult) {
      GenomeScale.updateDone = true;
      rootInstance.setSelection([mappingResult]);
      GenomeScale.updateDone = false;
    }
  }

  /**
   *  prepares HTMLElement for Slopegraph and
   *  adds classes required for LineUp
   * @param {HTMLElement} parentElement
   * @returns {HTMLElement[]}
   */
  prepareMappingElement(parentElement: HTMLElement): HTMLElement[] {
    parentElement.classList.add(cssClass());
    const head = document.createElement("section");
    const bod = document.createElement("section");
    head.setAttribute("id", "mapping-header");
    bod.setAttribute("id", "mapping-body");
    parentElement.append(...[head, bod]);

    head.classList.add(engineCssClass("header-separator"));
    head.classList.add(cssClass("slopegraph-header"));
    this.createHeader(head);
    bod.classList.add(engineCssClass("separator"));
    bod.classList.add(cssClass("slopegraph"));
    bod.style.height = `350px`;

    const createdElement: HTMLElement[] = [];
    createdElement.push(head);
    createdElement.push(bod);
    return createdElement;
  }
  /**
   *  create header of SlopeGraph
   * @param {HTMLElement} header
   */
  createHeader(header: HTMLElement) {
    const active = cssClass("active");
    header.innerHTML = `<i title="Item" class="${
      this._mode === EMode.ITEM ? active : ""
    }">${aria("Item")}</i>
        <i title="Band" class="${
          this._mode === EMode.BAND ? active : ""
        }">${aria("Band")}</i>`;

    const icons = Array.from(header.children) as HTMLElement[];
    icons.forEach((n: HTMLElement, i) => {
      n.onclick = (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        if (n.classList.contains(active)) {
          return;
        }
        // "this" is the SlopeGraph here
        // this.mode = i === 0 ? EMode.ITEM : EMode.BAND;
        icons.forEach((d, j) => d.classList.toggle(active, j === i));
      };
    });
  }

  /**
   *  render slopes initially and update on demand
   * @param {SlopeGraph} slopegraph
   * @param {EngineRanking[]} ranks
   */
  static renderSlopes(
    slopegraph: SmartSlopeGraph,
    ranks: EngineRanking[],
    getSelectedIndicies?: (dataIndex: number) => number | number[]
  ) {
    const indices = new Set(ranks.map((d) => ranks.indexOf(d)));

    if (slopegraph.hidden) {
      return;
    }
    const left = 0;
    const right = 1;
    if (!indices.has(left) && !indices.has(right)) {
      return;
    }
    const rootRanking = ranks[left];
    const dependentRanking = ranks[right];

    slopegraph.getSelectedIndicies = getSelectedIndicies;

    slopegraph.rebuild(
      rootRanking.ranking,
      rootRanking.currentData,
      rootRanking.context,
      dependentRanking.ranking,
      dependentRanking.currentData,
      dependentRanking.context
    );
  }
}
