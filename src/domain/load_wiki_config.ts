import path from "path";
import fsPromises from "fs/promises";
import {
  ALL_WIKI_LOADING_SOURCES,
  WikiLoadingSource,
} from "./wiki_loading_source";

/**
 * wikiのHTMLからの曲情報を読み込み時の設定
 */
export type LoadWikiConfig = Readonly<{
  /** 無視する曲の曲名リスト */
  ngTracks: ReadonlyMap<WikiLoadingSource, Set<string>>;
}>;

export async function readLoadWikiConfig(): Promise<LoadWikiConfig> {
  const filePath = path.join(process.cwd(), "load_wiki_config.json");
  const data = await fsPromises.readFile(filePath, { encoding: "utf8" });
  const json: LoadWikiConfigJSON = JSON.parse(data) as LoadWikiConfigJSON;

  return {
    ngTracks: new Map(
      ALL_WIKI_LOADING_SOURCES.map((source) => [
        source,
        new Set(json.ngTracks[source] ?? []),
      ]),
    ),
  };
}

type LoadWikiConfigJSON = Readonly<{
  /** 無視する曲の曲名リスト */
  ngTracks: Readonly<Record<WikiLoadingSource, ReadonlyArray<string>>>;
}>;
