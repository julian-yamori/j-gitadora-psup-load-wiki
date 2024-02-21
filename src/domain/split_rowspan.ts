import { HTMLElement } from "node-html-parser";

/**
 * テーブルのrowspanを分割し、セルの二次元配列に変換
 *
 * colspanは分割しない。
 * 1行まるごと結合した行は、区分の区切りとして取り除く必要があるため。
 * @param tableElement tableのHTML Element
 * @returns 行・列ごとに分割されたtdのHTML Element
 */
export default function splitRowspan(
  tableElement: HTMLElement,
): HTMLElement[][] {
  return (
    [...tableElement.querySelectorAll("tbody tr").entries()]
      .reduce<CellWithRowspanInfo[][]>((sum, [rowNo, rowElement]) => {
        // この行に直接存在するtdから、CellWithRowspanInfoの配列を作成
        const rowResults = [...rowElement.getElementsByTagName("td")].map(
          (elem) => {
            const rowspan = rowspanValueToNum(elem.getAttribute("rowspan"));
            return {
              cellElement: elem,
              lastRow: rowspan === undefined ? rowNo : rowNo + rowspan - 1,
            };
          },
        );

        // 前の行からのrowspanを、rowResultsに追加
        const lastRow = sum.at(-1);
        if (lastRow !== undefined) {
          for (const [colNo, cr] of lastRow.entries()) {
            if (rowNo <= cr.lastRow) {
              rowResults.splice(colNo, 0, cr);
            }
          }
        }

        // 結果の末尾に追加
        return [...sum, rowResults];
      }, [])
      // rowspan情報を除去し、戻り値の型に合わせる
      .map((row) => row.map((cr) => cr.cellElement))
  );
}

// tdのHTMLElementと、rowspan情報
type CellWithRowspanInfo = {
  cellElement: HTMLElement;
  // 最後に表示する行の番号
  lastRow: number;
};

// tdのrowspanの値をnumber型に変換
function rowspanValueToNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const num = Number(value);
  if (Number.isNaN(num)) return undefined;

  return num;
}
