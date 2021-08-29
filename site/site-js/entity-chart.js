import {
  op,
  worker,
} from "https://cdn.jsdelivr.net/npm/arquero-worker@0.0.2/dist/arquero-worker-client.mjs";

import "https://cdn.jsdelivr.net/npm/jquery@2.2.4";
import "https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0";

//const op = aq.op;

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
  const loc = window.location;
  // TODO: Improve this hacky business.
  // If on GitHub pages, assume site is deployed at root of repo path.
  // Note: GitHub pages root is <account>.github.io/<repo_name>/
  let workerUrl = loc.host.endsWith(".github.io")
    ? loc.pathname.match(/\/[^/]*/)[0]
    : "";
  workerUrl += "/site-js/arquero-worker.min.js";
  const aqWorker = worker(workerUrl);

  const rootDf = await aqWorker.load("payments", DATA_URL);

  let stop = timer("Worker frame");
  const perEntityDf = await rootDf
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
    .orderby("cycle")
    .fetch();
  stop();

  stop = timer("Foreground frames");
  const allEntityData = perEntityDf
    .groupby("cycle")
    .rollup({ amount: op.sum("amount") })
    .objects();
  const entities = perEntityDf
    .select("entity")
    .dedupe()
    .orderby("entity")
    .reify()
    .column("entity").data;
  stop();

  document.getElementById("chart-spinner").style.display = "none";
  document.getElementById("chart-view").style.display = "block";

  initEntityDropdown(function (e) {
    const value = e.target.value;
    const opts =
      value == "__ALL__"
        ? {
            entity: "(All Entities)",
            data: allEntityData,
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

  renderChart({ entity: "(All Entities)", data: allEntityData });
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
