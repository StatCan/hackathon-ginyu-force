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
const cols = {
  entity: "entity",
  cycle: "reporting_cylce",
  amount: "amount_reported_cad",
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
    })
    .derive({
      cycle: (d) => "" + d.cycle,
      amount: (d) => op.parse_float(op.replace(d.amount, /,/g, "")),
    })
    .groupby("entity", "cycle")
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
    .groupby("cycle")
    .rollup({ amount: op.sum("amount") });
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
  frag.appendChild(createOption("__ALL__", "(All)"));
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
  const ctx = document.getElementById("chart").getContext("2d");
  if (chart) {
    chart.destroy();
  }
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      datasets: [
        {
          data,
          label: entity,
          backgroundColor: "#00cc96",
        },
      ],
    },
    options: {
      parsing: {
        xAxisKey: "cycle",
        yAxisKey: "amount",
      },
      scales: {
        x: { title: { display: true, text: "Reporting Cycle" } },
        y: {
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
          display: false,
        },
      },
    },
  });
}

function timer(label) {
  const t0 = performance.now();
  return () => console.log(label, performance.now() - t0);
}
