$(function () {
  const DATA_URL =
    "https://raw.githubusercontent.com/StatCan/hackathon-ginyu-force-data/main/SAMPLE-ESTMA-data.csv";
  const renderers = $.extend(
    $.pivotUtilities.renderers,
    $.pivotUtilities.plotly_renderers,
    $.pivotUtilities.d3_renderers,
    $.pivotUtilities.export_renderers
  );
  fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) {
        throw res.status;
      }
      return res.text();
    })
    .then(parseCsv)
    .then((parsed) => initPivotTable(parsed.data))
    .catch((e) => alert(`Failed to load table from:\n${DATA_URL}`));

  function parseCsv(csv) {
    return new Promise(function (resolve, reject) {
      Papa.parse(csv, {
        skipEmptyLines: true,
        error: (e) => reject(e),
        complete: (parsed) => resolve(parsed),
      });
    });
  }

  function initPivotTable(data) {
    const iEntity = data[0].indexOf("entity");
    const uniques = data.slice(1).reduce(function (memo, row) {
      memo[row[iEntity]] = true;
      return memo;
    }, {});
    $("#table").pivotUI(
      data,
      {
        aggregatorName: "Sum",
        vals: ["amount_reported_cad"],
        cols: ["reporting_cylce"],
        rows: ["jurisdiction"],
        hiddenAttributes: [
          "estma_id",
          "payment_category",
          "period_end_date",
          "period_start_date",
          "web_Link",
          "payment_notes",
        ],
        hiddenFromDragDrop: ["amount_reported_cad"],
        menuLimit: Object.keys(uniques).length,
        renderers: renderers,
      },
      true
    );
  }
});
