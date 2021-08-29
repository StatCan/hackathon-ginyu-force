import {
  op,
  query,
  worker,
} from "https://cdn.jsdelivr.net/npm/arquero-worker@0.0.2/dist/arquero-worker-client.mjs";

import "https://cdn.jsdelivr.net/npm/jquery@2.2.4";
import "https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0";

const WORKER_URL =
  "https://cdn.jsdelivr.net/npm/arquero-worker@0.0.2/dist/arquero-worker.min.js";
const DATA_URL =
  "https://raw.githubusercontent.com/StatCan/hackathon-ginyu-force-data/main/SAMPLE-ESTMA-data.csv";

const CHART_COLORS = [
  "#2b4e5c",
  "#8278a5",
  "#389e93",
  "#707070",
  "#e6b868",
  "#e76f51",
  "#333333",
];

const cols = {
  entity: "entity",
  cycle: "reporting_cylce",
  amount: "amount_reported_cad",
  type: "payment_category",
};

let chart = null;

document.addEventListener("DOMContentLoaded", main);

async function main() {
  const workerObjUrl = await fetch(WORKER_URL)
    .then((r) => r.text())
    .then((js) => new Blob([js], { type: "application/json" }))
    .then(URL.createObjectURL);
  const aqWorker = worker(workerObjUrl);

  let stop = timer("Load CSV (worker)");
  await aqWorker.load("payments", DATA_URL);
  stop();

  stop = timer("Per entity grouping (worker)");
  let perEntityQuery = query("payments")
    .select({
      [cols.entity]: "entity",
      [cols.cycle]: "cycle",
      [cols.amount]: "amount",
      [cols.type]: "type",
    })
    .derive({
      cycle: (d) => "" + d.cycle,
      amount: (d) => op.parse_float(op.replace(d.amount, /,/g, "")),
    })
    .groupby("entity", "cycle", "type")
    .rollup({ amount: op.sum("amount") })
    .orderby("cycle");
  const perEntityRemote = await aqWorker.query(
    perEntityQuery.toObject(),
    {},
    "groupedPayments"
  );
  stop();

  stop = timer("All entity grouping (worker)");
  const allEntityRemote = perEntityRemote
    .groupby("cycle", "type")
    .rollup({ amount: op.sum("amount") })
    .orderby("cycle");
  stop();
  stop = timer("List entities (remote)");
  const entitiesRemote = perEntityRemote
    .select("entity")
    .dedupe()
    .orderby("entity");
  stop();

  stop = timer("Fetch results");
  const [perEntityDf, allEntityDf, entityDf] = await Promise.all([
    perEntityRemote.fetch(),
    allEntityRemote.fetch(),
    entitiesRemote.fetch(),
  ]);
  stop();

  const entities = entityDf.column("entity").data;
  const allEntityObjects = allEntityDf.objects();

  document.getElementById("chart-spinner").style.display = "none";
  document.getElementById("chart-view").style.display = "block";

  initEntityDropdown(function (e) {
    const value = e.target.value;
    const opts =
      value == "__ALL__"
        ? {
            entity: "(All Entities)",
            data: allEntityObjects,
          }
        : {
            entity: value,
            data: perEntityDf
              .params({ entity: value })
              .filter((d, $) => d.entity == $.entity)
              .objects(),
          };
    renderChart(opts);
  }, entities);

  renderChart({ entity: "(All Entities)", data: allEntityObjects });
}

function initEntityDropdown(onEntitySelect, entities) {
  const entityDropdown = document.querySelector("#entities");

  const frag = document.createDocumentFragment();
  frag.appendChild(createOption("__ALL__", "(All Entities)"));
  entities
    .map((entity) => createOption(entity, entity))
    .forEach((option) => frag.appendChild(option));
  entityDropdown.appendChild(frag);

  $(entityDropdown).select2().on("change", onEntitySelect);
}

function createOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function renderChart({ entity, data }) {
  const datasets = Object.entries(
    data.reduce(function (memo, row) {
      const type = row.type;
      if (!memo.hasOwnProperty(type)) {
        memo[type] = [];
      }
      memo[type].push({ x: row.cycle, y: row.amount });
      return memo;
    }, {})
  ).map(([type, data], i) => ({
    data,
    label: type,
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const ctx = document.getElementById("chart").getContext("2d");
  if (chart) {
    chart.destroy();
  }
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      datasets,
    },
    options: {
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: "Reporting Cycle" },
        },
        y: {
          stacked: true,
          title: { display: true, text: "Amount Reported ($)" },
          ticks: {
            callback: function (value, index, values) {
              return "$" + parseInt(value).toLocaleString();
            },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
        },
        tooltip: {
          mode: "index",
          callbacks: {
            footer(tooltipItems, _data) {
              let total = 0;
              for (const item of tooltipItems) {
                total += item.raw.y;
              }
              return (
                "Total: " +
                total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              );
            },
          },
        },
      },
    },
  });
}

function timer(label) {
  const t0 = performance.now();
  return () => console.log(label, performance.now() - t0);
}
