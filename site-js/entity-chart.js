(async function () {
  const DataFrame = dfjs.DataFrame;

  const DATA_URL =
    "https://raw.githubusercontent.com/StatCan/hackathon-ginyu-force-data/main/SAMPLE-ESTMA-data.csv";
  const cols = {
    entity: "entity",
    cycle: "reporting_cylce",
    amount: "amount_reported_cad",
  };

  let dataFrame = null,
    allEntitiesFrame = null,
    chart = null;

  document.addEventListener("DOMContentLoaded", main);

  async function main() {
    const dfWorker = new Worker("/site-js/data-frame-worker.js");
    dfWorker.onmessage = onDataFrameLoaded;
    dfWorker.postMessage(DATA_URL);
  }

  function onDataFrameLoaded(e) {
    const { data, columns } = e.data;
    dataFrame = new DataFrame(data, columns);
    allEntitiesFrame = dataFrame
      .groupBy(cols.cycle)
      .aggregate((group) => group.stat.sum(cols.amount))
      .rename("aggregation", cols.amount);

    const entities = dataFrame.distinct(cols.entity).toArray().flat().sort();
    initEntityDropdown(entities);

    renderChart("__ALL__");
  }

  function initEntityDropdown(entities) {
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

  function onEntitySelect(e) {
    const selectedEntity = e.target.value;
    if (selectedEntity == "") {
      return;
    }
    renderChart(selectedEntity);
  }

  function renderChart(entity) {
    const t0 = performance.now();
    const data = (
      entity === "__ALL__"
        ? allEntitiesFrame
        : dataFrame.where((row) => row.get(cols.entity) == entity)
    ).toCollection();
    const t1 = performance.now();
    console.log(`Render ${entity}`, t1 - t0);

    const entityName = entity == "__ALL__" ? "(All)" : entity;
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
            label: entityName,
            backgroundColor: "#00cc96",
          },
        ],
      },
      options: {
        parsing: {
          xAxisKey: cols.cycle,
          yAxisKey: cols.amount,
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
})();
