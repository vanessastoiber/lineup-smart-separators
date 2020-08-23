import * as LineUpJS from "lineupjs";
import "lineupjs/build/LineUpJS.css";

import "./scss/main-hierarchy.css";
import HierarchyLevelCellRenderer from "./TimeColumn/HierarchyLevelCellRenderer";

// For hierarchical columns
const hierarchy = {
  name: "0",
  color: "black",
  children: [
    {
      name: "Malignant Neoplasms",
      color: "green",
      children: [
        {
          name: "Respiratory Organs",
          color: "blue"
        },
        {
          name: "Melanoma",
          color: "blue"
        },
        {
          name: "Breast",
          color: "blue"
        }
      ]
    },
    {
      name: "Systemic Connective Tissue Disorders",
      color: "orange",
      children: [
        {
          name: "Dermatopolymyotisis",
          color: "red"
        },
        {
          name: "Systemic Lupus Erythematosus",
          color: "red"
        },
        {
          name: "Systemic Sclerosis",
          color: "red"
        }
      ]
    }
  ]
};
const leaves = [];

function visit(prefix, node) {
  if (node.children && node.children.length > 0) {
    node.children.forEach(function (n) {
      visit(prefix + node.name + ".", n);
    });
  } else {
    leaves.push(prefix + node.name);
  }
}

visit("", hierarchy);
const numCats = 5;
const arr = [];
const l = new Array(10).fill(0);
const cats = new Array(numCats).fill(0).map((_, i) => `c${i + 1}`);

for (let i = 0; i <= 10; ++i) {
  arr.push({
    number: Math.floor(Math.random() * 10),
    numbers: l.map((d) => Math.random() * 10),

    boolean: Math.random() >= 0.5,
    booleans: l.map((d) => Math.random() >= 0.5),

    categorical: cats[Math.floor(Math.random() * cats.length)],
    categoricals: l.map((d) => cats[Math.floor(Math.random() * cats.length)]),

    hierarchical: leaves[i % leaves.length],
    set: cats.filter(() => Math.random() > 0.3),

    numberMap: {
      a1: Math.random() * 10,
      a2: Math.random() * 10
    },
    categoricalMap: {
      a1: cats[Math.floor(Math.random() * cats.length)],
      a2: cats[Math.floor(Math.random() * cats.length)]
    }
  });
}
const builder = LineUpJS.builder(arr);
builder
  .rowHeight(50, 2) // increase rowHeight due to map columns
  .deriveColumns([
    "number",
    "numbers",
    "boolean",
    "booleans",
    "categorical",
    "categoricals",
    "set"
  ])

  // Number
  .column(
    LineUpJS.buildNumberColumn("numberMap")
      .asMap(["a1", "a2"])
      .label("NumberMap")
      .width(150)
  )

  // Categorical
  .column(
    LineUpJS.buildCategoricalColumn("categoricalMap", cats)
      .asMap(["a1", "a2"])
      .label("CategoricalMap")
      .width(150)
      .renderer("table")
  ) // other renderer might not work or are not implemented yet

  // Hierarchical
  .column(
    LineUpJS.buildHierarchicalColumn("hierarchical", hierarchy)
      .label("Hierarchical")
      .width(150)
  )

  // Action
  .column(
    LineUpJS.buildActionsColumn()
      .action({
        name: "Action",
        icon: "&#x2713;",
        className: "myClassName",
        action: (row) => {
          console.log(row);
        }
      })
      .label("Actions")
      .width(150)
  )

  // Annotate
  .column(
    LineUpJS.buildStringColumn("string").editable().label("Annotate").width(150)
  )

  // Ordinal
  .column(
    LineUpJS.buildCategoricalColumn("categorical", cats)
      .label("Ordinal")
      .asOrdinal()
      .width(150)
  )

  // BoxPlot
  .column(
    LineUpJS.buildNumberColumn("boxplot")
      .asBoxPlot()
      .label("BoxPlot")
      .width(150)
  );

const ranking = LineUpJS.buildRanking()

  // Add support columns
  .supportTypes()
  .allColumns()
  .group();

/**
 * NOTE: In order to select the HierarchyLebelCellRenderer at item level,
 * it is necessary to select group- and summaryrenderer in advance
 * */

builder
  .registerRenderer("HierarchyLevel", new HierarchyLevelCellRenderer())
  .ranking(ranking);
const lineup1 = builder.build(document.getElementById("lineup1"));
