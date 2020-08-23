import { EMode, EngineRanking, Ranking } from "lineupjs";
import { SmartSlopeGraph } from "./SmartSlopeGraph";
import {
  cssClass,
  aria,
  engineCssClass
} from "../SmartSeparator/LineUpInternals/internalFunctions";
import * as d3 from "d3";
import * as LineUpJS from "lineupjs";
import { min, max } from "d3";
import { EDrivingForce, EActions } from "./utils";
import { mappingData } from "../index";

export class TimeScale {
  private firstLineUpInstance: LineUpJS.LineUp;
  private secondLineUpInstance: LineUpJS.LineUp;
  private element: HTMLElement = document.getElementById("mapping");
  private dataStats: Object[];
  private leftData: Object[];
  private rightData: Object[];
  private drivingRanking: EDrivingForce;

  private _mode: EMode = EMode.ITEM;

  constructor(
    firstLineUpInstance: LineUpJS.LineUp,
    secondLineUpInstance: LineUpJS.LineUp,
    drivingRanking: EDrivingForce = EDrivingForce.left,
    data: [][],
    dataStats: Object[]
  ) {
    this.firstLineUpInstance = firstLineUpInstance;
    this.secondLineUpInstance = secondLineUpInstance;
    this.dataStats = dataStats;
    this.leftData = data[0];
    this.rightData = data[1];
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

  /**
   *  lookup function to get idtype mapping
   * @param {number[]} selection Selection of the ranking
   * @param {boolean} reverse Mapping from left to right or in reverse order
   * @returns {number[]}
   */
  static mappingResolverLookup = (
    selection: number[],
    reverse: boolean
  ): number[] => {
    const i = reverse ? 1 : 0;
    const ret = i === 1 ? 0 : 1;

    const mappingResult = [];

    mappingData.forEach((pair) => {
      if (pair[i] === selection[0]) {
        mappingResult.push(pair[ret]);
      }
    });
    return mappingResult;
  };

  init() {
    const instanceA = this.firstLineUpInstance;
    const instanceB = this.secondLineUpInstance;
    const leftData = this.dataStats[0];
    const rightData = this.dataStats[1];
    const minValue = min([leftData["min"], rightData["min"]]);

    const mappingElement: HTMLElement[] = this.prepareMappingElement(
      this.element
    );

    const rootInstance = this.drivingRanking === "left" ? instanceA : instanceB;
    const dependentInstance =
      rootInstance === instanceA ? instanceB : instanceA;

    // calculate min and max value from union of both available datasets
    const maxValue =
      this.drivingRanking === EDrivingForce.left
        ? max([leftData["max"], rightData["max"]])
        : min([leftData["max"], rightData["max"]]);

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

    // create timeScale
    const xScale = d3
      .scaleTime()
      .range([0, bodyHeight + 500])
      .domain([
        d3.timeDay.offset(new Date(minValue), -20),
        d3.timeDay.offset(new Date(maxValue), +30)
      ]);

    // get position of left header
    const headers = document.getElementsByTagName("header");

    const positionInfoHeader = headers.item(0).getBoundingClientRect();
    const formatter = d3.timeFormat("%m/%d/%Y");

    // Add axis
    const axis = svg
      .append("g")
      .attr("transform", `translate(100,10)`)
      .call(
        d3
          .axisRight(xScale)
          .tickValues([new Date(minValue), new Date(maxValue)])
          .tickFormat((d) => formatter(d))
      )
      .on("mousemove", function () {
        var xPosition = xScale.invert(d3.mouse(this)[1]);
      });

    // get dates for circles
    const datesToMark = [];
    const sideToFetch =
      this.drivingRanking === EDrivingForce.left
        ? this.leftData
        : this.rightData;
    sideToFetch.forEach((item) => {
      datesToMark.push(new Date(item["Date"]));
    });

    const datesToIndicate = [];
    const dependentSideToFetch =
      this.drivingRanking === "left" ? this.rightData : this.leftData;
    dependentSideToFetch.forEach((item) => {
      datesToIndicate.push(new Date(item["Date"]));
    });

    const dataToPass = this.rightData;

    // add circle for each row of the driving ranking
    svg
      .select("g")
      .selectAll("circle")
      .data(datesToMark)
      .enter()
      .append("circle")
      .attr("r", "5")
      .attr("fill", "#635F5D")
      .attr("class", "circle")
      .attr("cy", (d) => xScale(d))
      .attr("cx", 0)
      .on("click", function (d, i) {
        TimeScale.handleClickEvent(
          dependentInstance,
          rootInstance,
          dataToPass,
          d3.select(this),
          d,
          i
        );
      })
      .append("title")
      .text((d) => formatter(d));

    var triangles = [];
    datesToIndicate.forEach((data) => {
      triangles.push({ y: xScale(data) });
    });
    var triangleSymbol = d3.symbol().type(d3.symbolTriangle);

    var arrow = svg
      .select("g")
      .selectAll("path")
      .data(triangles)
      .enter()
      .append("path")
      .attr("class", "diamond")
      .attr(
        "d",
        triangleSymbol.size(function (d) {
          return 3;
        })
      )
      .attr("opacity", "0.3")
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-width", 1)
      .attr("cy", (d) => d.y)
      .attr("transform", function (d) {
        return "translate(0, " + d.y + ")";
      });

    var lasttriangle = [];
    // draw arrow on last value on scale
    lasttriangle.push({ y: new Date(xScale.domain()[1].toString()) });

    var arc = d3.symbol().type(d3.symbolTriangle);

    // arrow for scale
    var scaleArrow = svg
      .select("g")
      .selectAll("triangle")
      .data(lasttriangle)
      .enter()
      .append("path")
      .attr("class", "triangle")
      .attr("d", arc)
      .attr("fill", " #635f5d")
      .attr("stroke", "#635f5d")
      .attr("stroke-width", 1)
      //.attr("cy", (d) => d.y)
      .attr("transform", function (d) {
        return "translate(0, " + xScale(d.y) + ") rotate(-180)";
      });

    const firstlabel = new Date(xScale.domain()[0].toString());

    // add starting line to scale
    var line = svg
      .select("g")
      .append("line")
      .style("stroke", "#635f5d")
      .attr("stroke-width", 2)
      .attr("x1", xScale(firstlabel) - 9) // x position of the first end of the line
      .attr("y1", xScale(firstlabel)) // y position of the first end of the line
      .attr("x2", 10) // x position of the second end of the line
      .attr("y2", xScale(firstlabel)); // y position of the second end of the line

    // add time label
    var text = svg
      .select("g")
      .append("text")
      .attr("class", "node")
      .attr("x", 10)
      .attr("y", 10)
      .attr("font-family", "sans-serif")
      .attr("fill", "#635f5d")
      .text("time");

    // count occurences of values -> filter datesToMark
    const filteredDates = [];
    for (let i = 0; i <= datesToMark.length; i++) {
      if (TimeScale.countOccurences([i], true) > 1) {
        filteredDates.push(datesToMark[i]);
      }
    }
    // draw rectangles for aggregation
    svg
      .select("g")
      .selectAll("rect")
      .data(filteredDates)
      .enter()
      .append("rect")
      .attr("fill", "	#D3D3D3")
      .attr("opacity", "0.2")
      .style("stroke", "black")
      .attr("x", -8)
      .attr("y", function (data, i) {
        return xScale(data);
      })
      .attr("width", 16)
      .attr("height", function (data, i) {
        if (i === 0) {
          return xScale(filteredDates[1]) - xScale(filteredDates[0]);
        } else if (i === filteredDates.length - 1) {
          return xScale(filteredDates[i]) - 15 - xScale(filteredDates[i - 1]);
        }
        return xScale(filteredDates[i]) - xScale(filteredDates[i - 1]);
      });

    const intermediateDatesToMark = [];
    const oppositeSideToFetch =
      this.drivingRanking === EDrivingForce.left
        ? this.rightData
        : this.leftData;
    oppositeSideToFetch.forEach((item) => {
      intermediateDatesToMark.push(new Date(item["Date"]));
    });

    var xAxis = d3.axisLeft(xScale);

    // test implementation for zooming behaviour

    // const minTimeMilli = 8.64e7; // do not allow zooming beyond displaying one day
    // const maxTimeMilli = 6.3072e11; // approx 20 years

    // const widthMilli = maxValue.getTime() - minValue.getTime();

    // const minScaleFactor = widthMilli / maxTimeMilli;
    // const maxScaleFactor = widthMilli / minTimeMilli;

    // var zoom = d3
    //   .zoom()
    //   .scaleExtent([minScaleFactor, maxScaleFactor])
    //   .translateExtent([
    //     [-100, -100],
    //     [width + 90, height + 100]
    //   ])
    //   .on("zoom", zoomed);

    // svg.call(zoom);

    // function zoomed() {
    //   var new_x_scale = d3.event.transform.rescaleX(xScale);

    //   axis.transition().duration(0).call(xAxis.scale(new_x_scale));
    //   svg
    //     .selectAll(".diamond")
    //     .attr("transform", function (d) {
    //       return "translate(0 ," + new_x_scale(new_x_scale.invert(d.y)) + ")";
    //     })
    //     .attr("cy", function (d) {
    //       return new_x_scale(new_x_scale.invert(d.y));
    //     });

    //   svg.selectAll("circle").attr("cy", function (d) {
    //     return new_x_scale(d);
    //   });

    //   svg.selectAll("rect").attr("y", function (d) {
    //     return new_x_scale(d);
    //   });

    //   svg.selectAll("rect").attr("height", function (d, i) {
    //     if (i === 0) {
    //       return new_x_scale(filteredDates[1]) - new_x_scale(filteredDates[0]);
    //     } else if (i === filteredDates.length - 1) {
    //       return (
    //         new_x_scale(filteredDates[i]) -
    //         15 -
    //         new_x_scale(filteredDates[i - 1])
    //       );
    //     }
    //     return (
    //       new_x_scale(filteredDates[i]) - new_x_scale(filteredDates[i - 1])
    //     );
    //   });
    // }

    // svg
    //   .append("g")
    //   .attr("class", "axis axis--grid")
    //   .attr("transform", `translate(75, ${headerHeight}) rotate(90)`)
    //   .call(
    //     d3
    //       .axisBottom(xScale)
    //       .ticks(d3.timeDay, 7)
    //       .tickSize(-50)
    //       .tickFormat(function() {
    //         return null;
    //       })
    //   )
    //   .selectAll(".tick")
    //   .classed("tick--minor", function(d) {
    //     return d.getHours();
    //   });

    // svg
    //   .append("g")
    //   .attr("class", "axis axis--y")
    //   .attr("transform", "translate(0," + width + ")")
    //   .call(
    //     d3
    //       .axisRight(xScale)
    //       .ticks(d3.timeDay)
    //       .tickPadding(0)
    //   )
    //   .attr("text-anchor", null)
    //   .selectAll("text")
    //   .attr("y", 3);

    // svg
    //   .append("g")
    //   .attr("class", "brush")
    //   .call(
    //     d3
    //       .brushY()
    //       .extent([[0, 0], [width, height]])
    //       .on("end", brushended)
    //   );

    // function brushended() {
    //   if (!d3.event.sourceEvent) return; // Only transition after input.
    //   if (!d3.event.selection) return; // Ignore empty selections.
    //   var d0 = d3.event.selection.map(xScale.invert),
    //     d1 = d0.map(d3.timeDay.round);

    //   // If empty when rounded, use floor & ceil instead.
    //   if (d1[0] >= d1[1]) {
    //     d1[0] = d3.timeDay.floor(d0[0]);
    //     d1[1] = d3.timeDay.offset(d1[0]);
    //   }

    //   d3.select(this)
    //     .transition()
    //     .call(d3.event.target.move, d1.map(xScale));
    // }

    let propagateUpdate = false;

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
      TimeScale.mappingResolverLookup,
      xScale,
      this.drivingRanking
    );

    const rankingsForUpdate: EngineRanking[] = [];
    rankingsForUpdate.push((rootInstance as any).renderer.rankings[0]);
    rankingsForUpdate.push((dependentInstance as any).renderer.rankings[0]);

    TimeScale.renderSlopes(independentSlope, rankingsForUpdate);

    rootInstance.on(LineUpJS.LineUp.EVENT_SELECTION_CHANGED, function (
      selectedIndicies
    ) {
      // related circle can be calculated here because the indicies equal the mapping
      const relatedCircle = d3.selectAll("circle")._groups[0][
        selectedIndicies[0]
      ];

      TimeScale.handleSelectionChanged(
        dependentInstance,
        relatedCircle,
        selectedIndicies,
        propagateUpdate
      );
      TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
    });

    dependentInstance.on(LineUpJS.LineUp.EVENT_SELECTION_CHANGED, function (
      selectedIndicies
    ) {
      TimeScale.handleSelectionChangedMapping(
        rootInstance,
        selectedIndicies,
        propagateUpdate
      );
      TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
    });

    // Rerender slopes in case sorting changes
    const rankA: EngineRanking = (instanceA as any).renderer.rankings[0]
      .ranking;
    rankA.on(Ranking.EVENT_SORT_CRITERIA_CHANGED, (old, updated) => {
      if (old.length === updated.length) {
        if (old[0]["asc"] !== updated[0]["asc"]) {
          TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
        } else {
          return;
        }
      } else if (old.length === 0 || updated.length === 0) {
        TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
      } else {
        TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
      }
    });
    const rankB: EngineRanking = (instanceB as any).renderer.rankings[0]
      .ranking;
    rankB.on(Ranking.EVENT_SORT_CRITERIA_CHANGED, (old, updated) => {
      if (old.length === updated.length) {
        if (old[0]["asc"] !== updated[0]["asc"]) {
          TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
        } else {
          return;
        }
      } else if (old.length === 0 || updated.length === 0) {
        TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
      } else {
        TimeScale.renderSlopes(independentSlope, rankingsForUpdate);
      }
    });
  }

  /**
   *  function that handles click on circle on timeline and updates selection of rankings
   * @param {LineUpJS.LineUp} instanceA
   * @param {LineUpJS.LineUp} instanceB
   * @param {Object[]} data
   * @param {d3.Selection<SVGCircleElement, unknown, null, undefined>} current
   * @param {Date} date
   * @param {number} index
   */
  static handleClickEvent(
    dependentInstance: LineUpJS.LineUp,
    rootInstance: LineUpJS.LineUp,
    data: Object[],
    current: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    date: Date,
    index: number
  ) {
    const indexOfMatchingDate = [];

    let action: EActions = EActions.select;

    // check if already selected
    if (current.classed("selected")) {
      action = EActions.remove;
    }

    if (action === EActions.remove) {
      dependentInstance.setSelection([]);
      rootInstance.setSelection([]);
      current
        .classed("selected", false)
        .transition()
        .attr("r", 5)
        .attr("fill", "#635F5D");
      return;
    }

    // mark clicked circle
    current
      .selectAll(".circle")
      .transition()
      .attr("r", 10)
      .attr("class", "selected")
      .attr("fill", "#ffa500");

    // iterate through data to get corresponding row of rootInstance
    data.forEach((datarow: any, i: number) => {
      const getRowDate = new Date(datarow["Date"]);
      if (getRowDate.getTime() === date.getTime()) {
        indexOfMatchingDate.push(i);
      }
    });

    // update selection of root ranking
    const currentSelecionRoot = rootInstance.getSelection();

    if (currentSelecionRoot !== indexOfMatchingDate) {
      rootInstance.setSelection(indexOfMatchingDate);
    }
    // iterate through mapping to retrieve corresponding indicies of the dependentInstance
    const indiciesToUpdateDependent = this.mappingResolverLookup(
      indexOfMatchingDate,
      true
    );

    // update selection of dependent ranking
    const currentSelecionOther = dependentInstance.getSelection();
    if (currentSelecionOther !== indiciesToUpdateDependent) {
      dependentInstance.setSelection(indiciesToUpdateDependent);
    }
  }

  /**
   *  function that handles selection changed event on rootInstance
   * @param {LineUpJS.LineUp} dependentInstance
   * @param {d3.Selection<SVGCircleElement, unknown, null, undefined>} relatedCircle
   * @param {number[]} selectedIndicies
   */
  static handleSelectionChanged(
    dependentInstance: LineUpJS.LineUp,
    relatedCircle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    selectedIndicies: number[],
    propagateUpdate: boolean
  ) {
    let action: EActions = EActions.select;
    if (selectedIndicies.length === 0) {
      action = EActions.remove;
    }
    // select respective circles
    TimeScale.updateCircles(action, relatedCircle);
    const mappingResult = this.mappingResolverLookup(selectedIndicies, true);

    if (propagateUpdate) {
      return;
    }

    if (dependentInstance.getSelection() !== mappingResult) {
      propagateUpdate = true;
      dependentInstance.setSelection(mappingResult);
      propagateUpdate = false;
    }
  }

  /**
   *  function that handles selection changed event on dependentInstance
   * @param {LineUpJS.LineUp} dependentInstance
   * @param {d3.Selection<SVGCircleElement, unknown, null, undefined>} relatedCircle
   * @param {number[]} selectedIndicies
   */
  static handleSelectionChangedMapping(
    rootInstance: LineUpJS.LineUp,
    selectedIndicies: number[],
    propagateUpdate: boolean
  ) {
    let action: EActions = EActions.select;
    if (selectedIndicies.length === 0) {
      action = EActions.remove;
    }

    const mappingResult = this.mappingResolverLookup(selectedIndicies, false);

    // find related circle through mapping instead of index
    const mappingRelatedCircle = d3.selectAll("circle")._groups[0][
      mappingResult[0]
    ];

    // select respective circles
    TimeScale.updateCircles(action, mappingRelatedCircle, [rootInstance]);

    if (!propagateUpdate) {
      return;
    }

    if (rootInstance.getSelection() !== mappingResult) {
      propagateUpdate = true;
      rootInstance.setSelection(mappingResult);
      propagateUpdate = false;
    }
  }

  static updateCircles(
    action: string,
    relatedCircle,
    instancesToResetSelection?: LineUpJS.LineUp[]
  ) {
    // unselect all circles
    if (action === EActions.remove) {
      if (instancesToResetSelection) {
        instancesToResetSelection.forEach((instance) => {
          instance.setSelection([]);
        });
      }
      d3.selectAll("circle")
        .classed("selected", false)
        .transition()
        .attr("r", 5)
        .attr("fill", "#635F5D");
      return;
    }
    d3.select(relatedCircle)
      .transition()
      .attr("r", 10)
      .attr("class", "selected")
      .attr("fill", "#ffa500");
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
