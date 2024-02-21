import {
  WikiLoadingIssue,
  WikiLoadingIssueDelete,
  WikiLoadingIssueError,
} from "./wiki_loading_issue";
import { ParsedTrack, isEqualsParsedTrack } from "./parse_html/parsed_track";
import parseHTML from "./parse_html/parse_html";
import { Track } from "j-gitadora-psup/src/domain/track/track";
import { LoadWikiConfig, readLoadWikiConfig } from "./load_wiki_config";
import { ParsedRowToIssueResult, parsedRowToIssue } from "./parsed_to_issue";

/**
 * wikiのHTMLから曲情報を読み込み
 * @param newTracksHTML 「新曲リスト」ページの曲テーブルのHTML
 * @param oldGFDMTracksHTML 「旧曲リスト(初代〜XG3)」ページの曲テーブルのHTML
 * @param oldGDTracksHTML 「旧曲リスト(GITADORA)」ページの曲テーブルのHTML
 * @param existingTrackMap DB に既に存在する曲 (キー = 曲名, 値 = ID)
 */
export default async function loadWikiHTML({
  newTracksHTML,
  oldGFDMTracksHTML,
  oldGDTracksHTML,
  existingTrackMap,
  loadTrackFromDb,
}: {
  newTracksHTML: string;
  oldGFDMTracksHTML: string;
  oldGDTracksHTML: string;
  existingTrackMap: Map<string, string>;
  loadTrackFromDb: (id: string) => Promise<Track | undefined>;
}): Promise<WikiLoadingIssue[]> {
  const config = await readLoadWikiConfig();

  // HTML解析、NG曲除去、重複曲マージ
  const parsedRows = mergeRowsDuplicate(
    filterNgTracks(
      [
        ...parseHTML("new", newTracksHTML),
        ...parseHTML("old_GFDM", oldGFDMTracksHTML),
        ...parseHTML("old_GD", oldGDTracksHTML),
      ],
      config,
    ),
  );

  // HTMLから取得した曲データをIssueに変換
  const toIssueResults = await Promise.all(
    parsedRows.map((row) =>
      parsedRowToIssue(row, existingTrackMap, loadTrackFromDb),
    ),
  );
  const { matchTitles, issues } = splitIssueResults(toIssueResults);

  // DBに存在するが、今回読み込んだデータに無い曲は、削除予定とする
  const deleteIssues = [...existingTrackMap]
    .filter(([title]) => !matchTitles.has(title))
    .map(
      ([title, trackId]): WikiLoadingIssueDelete => ({
        type: "delete",
        trackId,
        title,
      }),
    );
  issues.push(...deleteIssues);

  return issues;
}

/**
 * configのNG曲に指定された曲を除去
 */
function filterNgTracks(
  rows: ReadonlyArray<ParsedTrack | WikiLoadingIssueError>,
  config: LoadWikiConfig,
): Array<ParsedTrack | WikiLoadingIssueError> {
  // typeがあればWikiLoadingIssueError型と判断し、そのまま返す
  return rows.filter((r) => {
    // typeがあればWikiLoadingIssueError型と判断し、そのまま返す
    if ("type" in r) return true;

    const set = config.ngTracks.get(r.source);
    if (set === undefined) return true;

    return !set.has(r.title);
  });
}

/**
 * HTMLテーブル行の重複データを統合
 * wikiの「新曲リスト」と「旧曲リスト」に同一データがあったりするので、自動でスキップできるようにする
 * @param rows HTMLから取得した全ての曲データ
 * @returns 重複を除去した曲データ
 */
function mergeRowsDuplicate(
  rows: ReadonlyArray<ParsedTrack | WikiLoadingIssueError>,
): Array<ParsedTrack | WikiLoadingIssueError> {
  // 曲名 -> 行 のマップ
  const titleMap = new Map<string, ParsedTrack>();

  let mergedRows: Array<ParsedTrack | WikiLoadingIssueError> = [];

  for (const row of rows) {
    // typeがあればWikiLoadingIssueError型と判断し、そのまま返す
    if ("type" in row) {
      mergedRows.push(row);
      continue;
    }

    const existing = titleMap.get(row.title);
    // 重複データが無ければそのまま返す
    if (existing === undefined) {
      mergedRows.push(row);
      titleMap.set(row.title, row);
    }
    // 重複データの内容が一致していればスルー、一致しなければエラー
    else if (!isEqualsParsedTrack(row, existing)) {
      // この曲は新規曲として追加しないように除去
      mergedRows = mergedRows.filter(
        (r) => "type" in r || r.title !== row.title,
      );

      mergedRows.push({
        type: "error",
        source: row.source,
        rowNo: row.rowNo,
        message: `重複データの内容が異なります : "${row.title}" ${existing.source} (${existing.rowNo})`,
      });
    }
  }

  return mergedRows;
}

/**
 * 行の解析結果から Issue へ変換した結果の配列を分割
 */
function splitIssueResults(results: ReadonlyArray<ParsedRowToIssueResult>): {
  matchTitles: Set<string>;
  issues: WikiLoadingIssue[];
} {
  const matchTitles = new Set<string>();
  const issues: WikiLoadingIssue[] = [];

  for (const r of results) {
    if (r.existingTitle !== undefined) {
      matchTitles.add(r.existingTitle);
    }

    if (r.issue !== undefined) {
      issues.push(r.issue);
    }
  }

  return { matchTitles, issues };
}
