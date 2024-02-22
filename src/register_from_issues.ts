/* eslint-disable no-await-in-loop -- updatedTrackIds の処理は手続き的な for ループの方が読みやすそうなので、一旦これで…… */

import TrackRepository from "j-gitadora-psup/src/db/track/track_repository";
import updateSkillPoint from "j-gitadora-psup/src/db/track/update_skill_point";
import neverError from "j-gitadora-psup/src/utils/never_error";
import { WikiLoadingIssue } from "./domain/wiki_loading_issue";
import prismaClient, { PrismaTransaction } from "./db/prisma_client";
import limitedPararellRun from "./limited_pararell_run";

/**
 * wikiから読み込みの、一旦保存した問題点からの登録を実行
 * @param issues 発生していた問題点リスト
 * @returns 更新した曲の ID のリスト
 */
export default async function registerFromIssues(
  issues: ReadonlyArray<WikiLoadingIssue>,
): Promise<void> {
  const registerTasks = issues.map(
    (issue) => () =>
      prismaClient.$transaction((tx) => {
        const repo = new TrackRepository(tx);
        return registerOneIssue(tx, issue, repo);
      }),
  );

  await limitedPararellRun(registerTasks, 5);
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
