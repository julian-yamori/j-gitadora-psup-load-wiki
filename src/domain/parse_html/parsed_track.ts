import { Score } from "j-gitadora-psup/src/domain/track/track";
import { Track } from "j-gitadora-psup/src/domain/track/track";
import { Difficulty } from "j-gitadora-psup/src/domain/track/difficulty";
import { WikiLoadingSource } from "../wiki_loading_source";

/** HTMLから読み込んだ直後の曲データ */
export type ParsedTrack = Omit<Track, "id" | "scores"> & {
  scores: ParsedScores;

  /** HTMLの取得元 */
  source: WikiLoadingSource;
  /** テーブル行の番号 */
  rowNo: number;
};

/** HTMLから読み込んだ直後の、曲の譜面データ */
export type ParsedScore = Omit<Score, "trackId">;

export type ParsedScores = Readonly<{
  [K in Difficulty]?: ParsedScore;
}>;

/** ParsedTrackの曲情報の内容が一致しているか比較 */
export function isEqualsParsedTrack(t1: ParsedTrack, t2: ParsedTrack): boolean {
  if (
    t1.title !== t2.title ||
    t1.skillType !== t2.skillType ||
    t1.long !== t2.long ||
    t1.openType !== t2.openType
  ) {
    return false;
  }

  const scores1 = [...Object.values(t1.scores)];
  const scores2 = [...Object.values(t2.scores)];

  // 譜面数を比較
  if (scores1.length !== scores2.length) {
    return false;
  }

  // 譜面毎に比較
  for (const d1 of scores1) {
    const d2 = scores2.find((d) => d.difficulty === d1.difficulty);
    if (d2 === undefined) return false;

    if (d1.lv !== d2.lv) return false;
  }

  return true;
}
