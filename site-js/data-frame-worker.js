importScripts("https://gmousse.github.io/dataframe-js/dist/dataframe.min.js");
const DataFrame = dfjs.DataFrame;

const cols = {
  entity: "entity",
  cycle: "reporting_cylce",
  amount: "amount_reported_cad",
};

onmessage = async function (e) {
  const dataFrame = (await DataFrame.fromCSV(e.data))
    .restructure(Object.values(cols))
    .map((row) =>
      row.set(cols.amount, parseFloat(row.get(cols.amount).replaceAll(",", "")))
    )
    .groupBy(cols.entity, cols.cycle)
    .aggregate((group) => group.stat.sum(cols.amount))
    .rename("aggregation", cols.amount)
    .sortBy(cols.cycle);
  postMessage({ columns: dataFrame.listColumns(), data: dataFrame.toArray() });
};
