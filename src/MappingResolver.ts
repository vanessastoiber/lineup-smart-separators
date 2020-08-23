import * as LineUpJS from "lineupjs";
import {
  EMode,
  IDateGrouper,
  IDateGranularity
} from "lineupjs";
import { toDateGroup } from "./TimeColumn/LineUpInternalsTime/internalDateFunctionality";
// import for n:m mapping
// import * as NMmappingData from "../data/genes-proteins/mapping.json";
// const mappingData = Object.assign([], NMmappingData);
//import for time aspect
//import { mappingData } from "./index-time";
// import { mappingData } from "./index-covid";

/**
 *  function to convert csv data file to array
 * @param {any} data
 * @param {string} delimiter
 * @param {boolean} omitFirstRow
 */
const CSVToArray = (data, delimiter = ",", omitFirstRow = false) =>
  data
    .slice(omitFirstRow ? data.indexOf("\n") + 1 : 0)
    .split("\n")
    .map((v) => v.split(delimiter));

// const realMappingData = [
//   ["MIA", "NP_001120654"],
//   ["FGFR4", "NP_001229"],
//   ["GPR160", "NP_004439"],
//   ["ACTR3B", "NP_061155"],
//   ["MLPH", "NP_006836"],
//   ["ERBB2", "NP_060601"],
//   ["ANLN", "NP_006598"],
//   ["PTTG1", "NP_002457"],
//   ["CEP55", "NP_000917"]
// ];

export class MappingResolver {
  private firstLineUpInstance: LineUpJS.LineUp;
  private secondLineUpInstance: LineUpJS.LineUp;
  private mappingData;

  private _mode: EMode = EMode.ITEM;

  constructor(
    firstLineUpInstance: LineUpJS.LineUp,
    secondLineUpInstance: LineUpJS.LineUp,
    mappingData: any
  ) {
    this.firstLineUpInstance = firstLineUpInstance;
    this.secondLineUpInstance = secondLineUpInstance;
    this.mappingData = mappingData;
  }

  // static countOccurences = (value: number[], reverse: boolean): number => {
  //   const direction = reverse ? 1 : 0;
  //   let counter: number = 0;
  //   mappingData.forEach((elem) => {
  //     if (elem[direction] === value[0]) {
  //       counter += 1;
  //     }
  //   });
  //   return counter;
  // };

  // TODO: Mapping with names instead of indices -> preprocessing!
  // Converts array with genes and proteins to array of indices
  // static mappingData = (realMappingData = realMappingData) => {
  //   realMappingData.map(function(sub) {
  //     const result = [];
  //     const gene = sub[0];
  //     const prot = sub[1];
  //     const geneRows = (instanceA as any).data._dataRows;
  //     const protRows = (instanceB as any).data._dataRows;
  //     console.log("testLookupItems", sub);
  //     geneRows.forEach((datarow: any) => {
  //       if (Object.values(datarow["v"])[0].toString() === gene.toString()) {
  //         console.log("PART1gene", gene);
  //         console.log("PART1row", Object.values(datarow["v"])[0]);
  //         sub[0] = datarow["i"];
  //       }
  //     });
  //     protRows.forEach((datarow: any) => {
  //       console.log("PART2gene", prot);
  //       console.log("PART2row", Object.values(datarow["v"])[0]);
  //       if (Object.values(datarow["v"])[0].toString() === prot.toString()) {
  //         sub[1] = datarow["i"];
  //       }
  //     });
  //     result.push(sub);
  //     return sub;
  //     // });
  //   });
  // };

  /**
   *  lookup function to get idtype mapping
   * @param {number[]} selection Selection of the ranking
   * @param {boolean} reverse Mapping from left to right or in reverse order
   * @returns {number | Number[]}
   */
  extendedMappingResolverLookup = (
    selection: number[],
    reverse: boolean
  ): number | Number[] => {
    const i = reverse ? 1 : 0;
    const ret = i === 1 ? 0 : 1;
    // check if first number exists in data
    if (this.mappingData.find((x) => x[i] === selection[0]) !== undefined) {
      // multiple selected
      if (selection.length > 1) {
        const matchingIndices: Number[] = [];
        selection.forEach((element: number) => {
          if (
            this.mappingData !== undefined &&
            this.mappingData.find((x) => x[i] === element) !== undefined
          ) {
            matchingIndices.push(
              this.mappingData.find((x) => x[i] === element)![ret]
            );
          }
        });
        // console.log("return matches", matchingIndices);
        return matchingIndices;
      } else if (this.countOccurences(selection, reverse) > 1) {
        // n:m cases
        const matchingIndices: Number[] = [];
        this.mappingData.forEach((elem) => {
          if (elem[i] === selection[0]) {
            matchingIndices.push(elem[ret]);
          }
        });
        // console.log("return matches", matchingIndices);
        return matchingIndices;
      } else {
        // single selection
        // console.log("return matches", mappingData.find(x => x[i] === selection[0])![ret]);
        return this.mappingData.find((x) => x[i] === selection[0])![ret];
      }
    } else {
      return selection;
    }
  };

  timeMappingResolverLookup = (
    selection: number[],
    reverse: boolean
  ): number[] => {
    const i = reverse ? 1 : 0;
    const ret = i === 1 ? 0 : 1;

    const mappingResult = [];

    this.mappingData.forEach((pair) => {
      if (pair[i] === selection[0]) {
        mappingResult.push(pair[ret]);
      }
    });

    return mappingResult;
  };

  countOccurences = (value: number[], reverse: boolean): number => {
    const direction = reverse ? 1 : 0;
    let counter: number = 0;
    this.mappingData.forEach((elem) => {
      if (elem[direction] === value[0]) {
        counter += 1;
      }
    });
    return counter;
  };
}

/**
 *  standalone function to create derived datasets
 * Mappingresolver is initialized at a later time so a static function does not work
 * @param {Object[]} data
 * @returns {Map<string, Object[]>}
 */
export function deriveDataset(data: Object[], granularity: IDateGranularity) {
  // mapping item to week
  const itemLookup: Map<string, Object[]> = new Map<string, Object[]>();
  const itemLookupTests: Map<string, number> = new Map<string, number>();
  // storage for aggregated dataobject
  const cumulativeObjectLookup: Map<string, Object> = new Map<
    string,
    Object[]
  >();

  const grouper: IDateGrouper = { granularity: granularity, circular: false };
  const mapping = [];
  data.map((row, i) => {
    const createdDate = new Date(row["Date"]);
    const groupResult = toDateGroup(grouper, createdDate);
    if (itemLookup.has(groupResult["name"])) {
      itemLookup.get(groupResult["name"]).push(row);
    } else {
      // create Mapping
      itemLookup.set(groupResult["name"], [row]);
      itemLookupTests.set(groupResult["name"], itemLookupTests.size);
    }
    mapping.push([i, itemLookupTests.get(groupResult["name"])]);
    return groupResult;
  });
  let sumConfirmed = 0;
  let sumDeaths = 0;
  let sumRecovered = 0;
  let sumActive = 0;
  let groupName;
  itemLookup.forEach(function (key, value) {
    key.forEach((item) => {
      const confirmed = item["Confirmed"];
      sumConfirmed += confirmed;
      const dead = item["Deaths"];
      sumDeaths += dead;
      const recovered = item["Recovered"];
      sumRecovered += recovered;
      const active = item["Active"];
      sumActive += active;
    });
    groupName = value;

    const newKey = key.map((item) => {
      item["Confirmed"] = sumConfirmed;
      item["Deaths"] = sumDeaths;
      item["Recovered"] = sumRecovered;
      item["Active"] = sumActive;
      return item;
    });
    if (!cumulativeObjectLookup.has(value)) {
      // console.log("resultOfMapping check", value, newKey);
      cumulativeObjectLookup.set(value, newKey);
    }
  });
  const resultArray = [];
  resultArray.push(cumulativeObjectLookup);
  resultArray.push(mapping);
  return resultArray;
}

// deepcopy of data from first LineUp instance
export const cloneData = (dataArray) => {
  const newData = [];
  dataArray.forEach((value) => {
    newData.push({ ...value });
  });
  return newData;
};
