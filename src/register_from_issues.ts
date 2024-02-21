/* eslint-disable no-await-in-loop -- updatedTrackIds の処理は手続き的な for ループの方が読みやすそうなので、一旦これで…… */

import TrackRepository from "j-gitadora-psup/src/db/track/track_repository";
import updateSkillPoint from "j-gitadora-psup/src/db/track/update_skill_point";
import neverError from "j-gitadora-psup/src/utils/never_error";
import { WikiLoadingIssue } from "./domain/wiki_loading_issue";
import prismaClient, { PrismaTransaction } from "./db/prisma_client";

/**
 * wikiから読み込みの、一旦保存した問題点からの登録を実行
 * @param issues 発生していた問題点リスト
 * @returns 更新した曲の ID のリスト
 */
export default async function registerFromIssues(
  issues: ReadonlyArray<WikiLoadingIssue>,
): Promise<void> {
  // トランザクションを 100 レコードずつに分ける
  for (const block of splitIssueArray(issues)) {
    await prismaClient.$transaction(
      async (tx) => {
        const repo = new TrackRepository(tx);
        await Promise.all(block.map((i) => registerOneIssue(tx, i, repo)));
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }
}

function splitIssueArray(
  issues: ReadonlyArray<WikiLoadingIssue>,
): WikiLoadingIssue[][] {
  const CYCLE = 1;

  const results: WikiLoadingIssue[][] = [];
  for (let i = 0; i < issues.length; i += CYCLE) {
    results.push(issues.slice(i, i + CYCLE));
  }

  return results;
}

async function registerOneIssue(
  tx: PrismaTransaction,
  issue: WikiLoadingIssue,
  trackRepository: TrackRepository,
): Promise<void> {
  const { type } = issue;
  switch (type) {
    case "new":
      await trackRepository.create(issue.newTrack);
      break;
    case "diff":
      await trackRepository.update(issue.newTrack);
      await updateSkillPoint(tx, issue.newTrack.id);
      break;
    case "delete":
      await trackRepository.delete(issue.trackId);
      break;

    case "error":
      throw Error(`error remains`);

    default:
      throw neverError(type);
  }
}
