import * as LineUpJS from "lineupjs";
import "lineupjs/build/LineUpJS.css";
import { parse, ParseResult } from "papaparse";

import "./scss/main-genome.css";
import { MappingResolver } from "./MappingResolver";
import * as exportDumpA from "../data/genes-proteins/dumpgenes.json";
import * as exportDumpB from "../data/genes-proteins/dumpproteins.json";
import * as exportDataA from "../data/genes-proteins/genes.txt";
import * as exportDataB from "../data/genes-proteins/proteins.txt";
import { GenomeScale } from "./SmartSeparator/GenomeScale";
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
  .column(LineUpJS.buildStringColumn("GeneSymbol"))
  .deriveColors()
  .restore(dumpA)
  .sidePanel(false, true)
  .build(document.getElementById("lineup1"));

const lineup2: LineUpJS.LineUp = LineUpJS.builder(parsedB.data.reverse())
  .column(LineUpJS.buildStringColumn("RefSeqProteinID"))
  .deriveColors()
  .restore(dumpB)
  .sidePanel(false, true)
  .build(document.getElementById("lineup2"));

setTimeout(() => {
  const scale = new GenomeScale(lineup1, lineup2, EDrivingForce.left);
  scale.init();
}, 1000);
