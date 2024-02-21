import { Difficulty } from "j-gitadora-psup/src/domain/track/difficulty";
import { Track } from "j-gitadora-psup/src/domain/track/track";
import { WikiLoadingSource } from "./wiki_loading_source";

/** Wikiからの曲情報の取り込み時の、曲一つについての問題 */
export type WikiLoadingIssue =
  | WikiLoadingIssueNew
  | WikiLoadingIssueDiffirence
  | WikiLoadingIssueDelete
  | WikiLoadingIssueError;

export type WikiLoadingIssueType = "new" | "diff" | "delete" | "error";

/** Wikiからの曲情報の取り込み時の曲の問題: DBには該当する曲が無く、これから追加しようとしている */
export type WikiLoadingIssueNew = {
  type: "new";

  /** HTMLの取得元 */
  source: WikiLoadingSource;
  /** テーブル行の番号 */
  rowNo: number;

  /**
   * 新しく登録しようとしている曲の情報
   *
   * IDは新規作成する
   */
  newTrack: Track;
};

/** Wikiからの曲情報の取り込み時の曲の問題: DBにある曲の情報と、異なる情報を登録しようとしている */
export type WikiLoadingIssueDiffirence = {
  type: "diff";

  /** HTMLの取得元 */
  source: WikiLoadingSource;
  /** テーブル行の番号 */
  rowNo: number;

  /**
   * 新しく登録しようとしている曲の情報
   *
   * IDは既存の曲のデータと合わせる
   */
  newTrack: Track;

  diffirences: ReadonlyArray<TrackDiffirence>;
};

/** Wikiからの曲情報の取り込み時の曲の問題: DBにはあるがwikiから新しく取り込んだデータには無く、削除しようとしている */
export type WikiLoadingIssueDelete = {
  type: "delete";

  /** 削除しようとしている曲のID */
  trackId: string;

  /** 削除しようとしている曲の曲名 */
  title: string;
};

/** Wikiからの曲情報の取り込み時の曲の問題: 取り込もうとしている曲のデータにエラーがある */
export type WikiLoadingIssueError = {
  type: "error";

  /** HTMLの取得元 */
  source: WikiLoadingSource;
  /** テーブル行の番号 (行を特定できないエラーならundefined) */
  rowNo: number | undefined;

  /** エラーメッセージ */
  message: string;
};

/** 曲データの値ひとつについての齟齬 */
export type TrackDiffirence = {
  /** 曲ID */
  trackId: string;

  /** 齟齬が発生している項目の名前 */
  propertyName: string;

  /**
   * データに齟齬が発生している譜面の難易度
   *
   * 譜面の値ではなくTrack自体の齟齬ならundefined
   */
  difficulty: Difficulty | undefined;

  /** 既存データ側の値 (表示用に文字列化) */
  oldValue: string | undefined;

  /** 新規データ側の値 (表示用に文字列化) */
  newValue: string | undefined;
};
