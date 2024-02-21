import { HTMLElement, NodeType } from "node-html-parser";
import {
  OpenType,
  INITIAL,
  EVENT,
  ENCORE,
  PREMIUM_ENCORE,
  DX,
} from "@/domain/track/open_type";
import { Err, Ok, Result } from "@/utils/result";

/** 「分類」列を変換 */
export default function convertBunrui(
  bunruiCell: HTMLElement,
): Result<{ openType: OpenType; long: boolean }, string> {
  const openTypes: OpenType[] = [];
  const longs: boolean[] = [];

  for (const text of parseBunruiCell(bunruiCell)) {
    const enMatch = text.match(/^EN(\d+)$/);
    if (enMatch) {
      openTypes.push(ENCORE);
    } else if (text.match(/^PE\d+$/)) {
      openTypes.push(PREMIUM_ENCORE);
    } else {
      switch (text) {
        // 以下の分類は無視
        case "版": // 版権曲
        case "S": // セッション専用曲
        case "GF": // ギターフリークス専用曲
        case "DM": // ドラムマニア専用曲
        case "×": // セッション不可
        case "e": // e-amusement pass解禁曲
          break;

        case "SEC":
        case "10":
        case "20":
          openTypes.push(EVENT);
          break;

        case "DX":
          openTypes.push(DX);
          break;

        case "L":
          longs.push(true);
          break;

        default:
          return new Err(errorMsgUnknownBunrui(text));
      }
    }
  }

  if (openTypes.length > 1) {
    return new Err(`OpenTypeが複数指定されました : ${openTypes.join(",")}`);
  }
  if (longs.length > 1) {
    return new Err(`longが複数指定されました : ${longs.join(",")}`);
  }

  return new Ok({
    openType: openTypes.at(0) ?? INITIAL,
    long: longs.at(0) ?? false,
  });
}

/**
 * 分類セルを構文解析
 * @param cell 分類の<td>
 * @returns タグで区切られたテキストの配列
 */
function parseBunruiCell(cell: HTMLElement): string[] {
  const result: string[] = [];

  // <br>区切りで複数あることがあるので分解
  for (const child of cell.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      if (child.text !== null) {
        const trimed = child.text.trim();
        if (trimed.length > 0) {
          result.push(trimed);
        }
      }
    }
  }

  return result;
}

/** 分類列が不明な場合のエラーメッセージを作成 */
function errorMsgUnknownBunrui(bunruiText: string): string {
  return `不明な分類です : ${bunruiText}`;
}
