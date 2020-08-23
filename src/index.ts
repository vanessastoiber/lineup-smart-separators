import * as LineUpJS from "lineupjs";
import "lineupjs/build/LineUpJS.css";
import { parse, ParseResult } from "papaparse";

import "./scss/main.css";
import { cloneData, deriveDataset } from "./MappingResolver";
import * as exportDumpA from "../data/time/dumpCovid.json";
import * as exportDumpB from "../data/time/dumpUnemployment.json";
import * as exportDataA from "../data/time/covid.txt";
import * as exportDataB from "../data/time/unemployment.txt";
import { IDateGranularity } from "lineupjs";
import { TimeScale } from "./SmartSeparator/TimeScale";
import TimeColumnCellRenderer from "./TimeColumn/TimeColumnCellRenderer";
import { EDrivingForce } from "./SmartSeparator/utils";

const parsedA: ParseResult<object> = parse(exportDataA.default, {
  dynamicTyping: true,
  header: true,
  skipEmptyLines: true
});
const dumpA = exportDumpA;

const parsedB: ParseResult<object> = parse(exportDataB.default, {
  dynamicTyping: true,
  header: true,
  skipEmptyLines: true
});
const dumpB = exportDumpB;

const lineup1: LineUpJS.LineUp = LineUpJS.builder(parsedA.data)
  .registerRenderer("TimeColumn", new TimeColumnCellRenderer())
  .column(LineUpJS.buildStringColumn("Country/Region"))
  .column(LineUpJS.buildDateColumn("Date"))
  .column(LineUpJS.buildNumberColumn("Confirmed"))
  .column(LineUpJS.buildNumberColumn("Deaths"))
  .deriveColors()
  .restore(dumpA)
  .sidePanel(false, true)
  .build(document.getElementById("lineup1"));

const parsedLeft = cloneData(parsedA.data);
const derived = deriveDataset(parsedLeft, "month" as IDateGranularity);
const result = Array.from(derived[0].values()).map((item) => {
  return item[0];
});
export const mappingData = derived[1];
const groupedData = derived[0];

const availableColumns = (lineup1 as any).renderer.rankings[0].ranking.columns;
const colForStatsLeft = availableColumns[availableColumns.length - 1];
const statsLeft = (lineup1 as any).renderer.ctx.tasks
  .summaryDateStats(colForStatsLeft)
  .then((stat) => {
    return stat["data"];
  });

const lineup2: LineUpJS.LineUp = LineUpJS.builder(parsedB.data)
  .column(LineUpJS.buildStringColumn("Country"))
  .column(LineUpJS.buildDateColumn("Date"))
  .column(LineUpJS.buildNumberColumn("Rate"))
  .deriveColors()
  .restore(dumpB)
  .sidePanel(false, true)
  .build(document.getElementById("lineup2"));

const parsedRight = cloneData(parsedB.data);

const colForStatsRight = (lineup2 as any).renderer.rankings[0].ranking
  .columns[4];
const statsRight = (lineup2 as any).renderer.ctx.tasks
  .summaryDateStats(colForStatsRight)
  .then((stat) => {
    return stat["data"];
  });

setTimeout(() => {
  const scale = new TimeScale(
    lineup1,
    lineup2,
    EDrivingForce.right,
    [parsedLeft, parsedRight],
    [statsLeft, statsRight]
  );
  scale.init();
}, 1000);
