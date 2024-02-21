/** Wikiからの曲情報の取り込み時の、HTMLの取得元 */
export type WikiLoadingSource =
  /** 新曲リスト */
  | "new"
  /** 旧曲リスト : 初代〜XG3 (GuitarFreaks & DrumMania) */
  | "old_GFDM"
  /** 旧曲リスト : GITADORA */
  | "old_GD";

export const ALL_WIKI_LOADING_SOURCES: ReadonlyArray<WikiLoadingSource> = [
  "new",
  "old_GFDM",
  "old_GD",
];

export function validateWikiLoadingSource(source: string): WikiLoadingSource {
  switch (source) {
    case "new":
    case "old_GFDM":
    case "old_GD":
      return source;
    default:
      throw Error(`unknown WikiLoadingSource: ${source}`);
  }
}
