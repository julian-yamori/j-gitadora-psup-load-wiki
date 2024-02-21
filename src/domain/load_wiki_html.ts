import {
  TrackDiffirence,
  WikiLoadingIssue,
  WikiLoadingIssueDelete,
  WikiLoadingIssueError,
} from "./wiki_loading_issue";
import { ParsedTrack, isEqualsParsedTrack } from "./parsed_track";
import parseHTML from "./parse_html";
import { Track, lvToString } from "j-gitadora-psup/src/domain/track/track";
import { skillTypeToStr } from "j-gitadora-psup/src/domain/track/skill_type";
import { openTypeToStr } from "j-gitadora-psup/src/domain/track/open_type";
import { ALL_DIFFICULTIES } from "j-gitadora-psup/src/domain/track/difficulty";
import { LoadWikiConfig, readLoadWikiConfig } from "./load_wiki_config";
import crypto from "node:crypto";

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

  const issues: WikiLoadingIssue[] = [];

  // HTMLから取得した曲データをIssueに変換
  for (const row of parsedRows) {
    // eslint-disable-next-line no-await-in-loop -- 手続き的な処理のリファクタが面倒なので、一旦 await-in-loop で……
    const issue = await parsedRowToIssue(
      row,
      existingTrackMap,
      loadTrackFromDb,
    );
    if (issue !== undefined) {
      issues.push(issue);
    }
  }

  // 新規データに無い曲IDは削除予定とする
  issues.push(
    ...[...existingTrackMap].map(
      ([title, trackId]): WikiLoadingIssueDelete => ({
        type: "delete",
        trackId,
        title,
      }),
    ),
  );

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
 * HTMLテーブル1行の解析結果を、WikiLoadingIssueに変換
 * @param row 変換元の曲データ、もしくはエラー情報
 * @param existingTrackMap 既に存在している曲のMap (keyは曲名、valueはID)
 * @returns 変換されたIssue。特に問題がなければundefined
 */
async function parsedRowToIssue(
  row: ParsedTrack | WikiLoadingIssueError,
  existingTrackMap: Map<string, string>,
  loadTrackFromDb: (id: string) => Promise<Track | undefined>,
): Promise<WikiLoadingIssue | undefined> {
  // typeがあればWikiLoadingIssueError型と判断する
  if ("type" in row) return row;

  const existingId = existingTrackMap.get(row.title);

  // 曲名が同じ曲がDBに無ければ、新規追加
  if (existingId === undefined) {
    return {
      type: "new",
      source: row.source,
      rowNo: row.rowNo,
      newTrack: addIdToParsedTrack(row, newTrackId()),
    };
  }

  existingTrackMap.delete(row.title);

  // 既存の曲データと比較
  const oldTrack = await loadTrackFromDb(existingId);
  if (oldTrack === undefined) throw Error(`Track not found : ${existingId}`);

  const diffirences = compareTrack(oldTrack, row);
  if (diffirences.length > 0) {
    return {
      type: "diff",
      source: row.source,
      rowNo: row.rowNo,
      newTrack: addIdToParsedTrack(row, existingId),
      diffirences,
    };
  }

  return undefined;
}

/** TrackNoIdに曲IDを付与 */
function addIdToParsedTrack(track: ParsedTrack, id: string): Track {
  return {
    ...track,
    id,
    scores: Object.fromEntries(
      Object.entries(track.scores).map(([k, d]) => [k, { ...d, trackId: id }]),
    ),
  };
}

/** 曲のIDを新規作成 */
function newTrackId(): string {
  return crypto.randomUUID();
}

/** 既存の曲データと新規曲データを比較 */
function compareTrack(
  oldTrack: Track,
  newTrack: ParsedTrack,
): TrackDiffirence[] {
  const diffs: TrackDiffirence[] = [];

  if (oldTrack.title !== newTrack.title) {
    diffs.push({
      trackId: oldTrack.id,
      propertyName: "title",
      difficulty: undefined,
      oldValue: oldTrack.title,
      newValue: newTrack.title,
    });
  }

  if (oldTrack.artist !== newTrack.artist) {
    diffs.push({
      trackId: oldTrack.id,
      propertyName: "artist",
      difficulty: undefined,
      oldValue: oldTrack.artist,
      newValue: newTrack.artist,
    });
  }

  if (oldTrack.skillType !== newTrack.skillType) {
    diffs.push({
      trackId: oldTrack.id,
      propertyName: "skillType",
      difficulty: undefined,
      oldValue: skillTypeToStr(oldTrack.skillType),
      newValue: skillTypeToStr(newTrack.skillType),
    });
  }

  if (oldTrack.long !== newTrack.long) {
    diffs.push({
      trackId: oldTrack.id,
      propertyName: "long",
      difficulty: undefined,
      oldValue: oldTrack.long.toString(),
      newValue: newTrack.long.toString(),
    });
  }

  if (oldTrack.openType !== newTrack.openType) {
    diffs.push({
      trackId: oldTrack.id,
      propertyName: "openType",
      difficulty: undefined,
      oldValue: openTypeToStr(oldTrack.openType),
      newValue: openTypeToStr(newTrack.openType),
    });
  }

  for (const difficulty of ALL_DIFFICULTIES) {
    const oldLv = oldTrack.scores[difficulty]?.lv;
    const newLv = newTrack.scores[difficulty]?.lv;

    if (oldLv !== newLv) {
      diffs.push({
        trackId: oldTrack.id,
        propertyName: "lv",
        difficulty,
        oldValue: oldLv !== undefined ? lvToString(oldLv) : "--",
        newValue: newLv !== undefined ? lvToString(newLv) : "--",
      });
    }
  }

  return diffs;
}
