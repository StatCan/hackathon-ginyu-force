$(function () {
  const DATA_URL =
    "https://raw.githubusercontent.com/StatCan/hackathon-ginyu-force-data/main/SAMPLE-ESTMA-data.csv";
  const STATE_KEYS = [
    "cols",
    "rows",
    "vals",
    "rowOrder",
    "colOrder",
    "exclusions",
    "inclusions",
    "aggregatorName",
    "rendererName",
  ];
  const DEFAULT_STATE = {
    aggregatorName: "Sum",
    vals: ["amount_reported_cad"],
    cols: ["reporting_cylce"],
    rows: ["jurisdiction"],
  };

  fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) {
        throw res.status;
      }
      return res.text();
    })
    .then(parseCsv)
    .then((parsed) => initPivotTable(parsed.data))
    .catch((_) => alert(`Failed to load table from:\n${DATA_URL}`));

  function parseCsv(csv) {
    return new Promise(function (resolve, reject) {
      Papa.parse(csv, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transform: function (value, field) {
          if (field !== "amount_reported_cad") {
            return value;
          }
          return value.replaceAll(",", "");
        },
        error: (e) => reject(e),
        complete: (parsed) => {
          initPivotTable(parsed.data);
        },
      });
    });
  }

  function initPivotTable(data) {
    const renderers = $.extend(
      $.pivotUtilities.renderers,
      $.pivotUtilities.plotly_renderers,
      $.pivotUtilities.d3_renderers,
      $.pivotUtilities.export_renderers
    );

    try {
      var hashState = _(getNormalizedHash())
        .thru((hash) => new URLSearchParams(hash).get("state"))
        .thru(atob)
        .thru(JSON.parse)
        .pick(STATE_KEYS)
        .value();
    } catch {
      hashState = {};
    }
    const state = _.defaults(hashState, DEFAULT_STATE);

    const numEntities = _(data)
      .map((row) => row.entity)
      .uniq()
      .size();

    $("#table").pivotUI(
      data,
      {
        ...state,
        hiddenAttributes: [
          "estma_id",
          "payment_category",
          "period_end_date",
          "period_start_date",
          "web_Link",
          "payment_notes",
        ],
        hiddenFromDragDrop: ["amount_reported_cad"],
        autoSortUnusedAttrs: true,
        menuLimit: numEntities,
        renderers: renderers,
        onRefresh: onTableRefresh,
      },
      true
    );
  }

  function onTableRefresh(config) {
    const state = _(config)
      .pick(STATE_KEYS)
      .thru(JSON.stringify)
      .thru(btoa)
      .value();
    const params = new URLSearchParams(getNormalizedHash());
    params.set("state", state);
    window.location.hash = params.toString();
  }

  function getNormalizedHash() {
    const hash = window.location.hash;
    return hash.length > 0 ? hash.substr(1) : hash;
  }
});
