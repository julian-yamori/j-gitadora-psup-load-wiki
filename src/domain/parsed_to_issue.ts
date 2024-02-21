import {
  TrackDiffirence,
  WikiLoadingIssue,
  WikiLoadingIssueError,
} from "./wiki_loading_issue";
import { ParsedTrack } from "./parse_html/parsed_track";
import { Track, lvToString } from "j-gitadora-psup/src/domain/track/track";
import { skillTypeToStr } from "j-gitadora-psup/src/domain/track/skill_type";
import { openTypeToStr } from "j-gitadora-psup/src/domain/track/open_type";
import { ALL_DIFFICULTIES } from "j-gitadora-psup/src/domain/track/difficulty";
import crypto from "node:crypto";

export type ParsedRowToIssueResult = {
  existingTitle: string | undefined;
  issue: WikiLoadingIssue | undefined;
};

export type ParsedRowToIssueResultMatches = {
  type: "matches";
  trackTitle: string;
};

export type ParsedRowToIssueResultIssue = {
  type: "issue";
  issue: WikiLoadingIssue;
};

/**
 * HTMLテーブル1行の解析結果を、WikiLoadingIssueに変換
 * @param row 変換元の曲データ、もしくはエラー情報
 * @param existingTrackMap 既に存在している曲のMap (keyは曲名、valueはID)
 */
export async function parsedRowToIssue(
  row: ParsedTrack | WikiLoadingIssueError,
  existingTrackMap: ReadonlyMap<string, string>,
  loadTrackFromDb: (id: string) => Promise<Track | undefined>,
): Promise<ParsedRowToIssueResult> {
  // typeがあればWikiLoadingIssueError型と判断する
  if ("type" in row) return { existingTitle: undefined, issue: row };

  const existingId = existingTrackMap.get(row.title);

  // 曲名が同じ曲がDBに無ければ、新規追加
  if (existingId === undefined) {
    return {
      existingTitle: undefined,
      issue: {
        type: "new",
        source: row.source,
        rowNo: row.rowNo,
        newTrack: addIdToParsedTrack(row, newTrackId()),
      },
    };
  }

  const existingTitle = row.title;

  // 既存の曲データと比較
  const oldTrack = await loadTrackFromDb(existingId);
  if (oldTrack === undefined) throw Error(`Track not found : ${existingId}`);

  const diffirences = compareTrack(oldTrack, row);
  if (diffirences.length > 0) {
    return {
      existingTitle,
      issue: {
        type: "diff",
        source: row.source,
        rowNo: row.rowNo,
        newTrack: addIdToParsedTrack(row, existingId),
        diffirences,
      },
    };
  }

  return { existingTitle, issue: undefined };
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
