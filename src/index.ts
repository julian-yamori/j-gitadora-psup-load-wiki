import fs from "node:fs";
import readline from "node:readline";
import process from "node:process";
import TrackRepository from "j-gitadora-psup/src/db/track/track_repository";
import updateSkillPoint from "j-gitadora-psup/src/db/track/update_skill_point";
import prismaClient from "./db/prisma_client";
import LoadWikiHtmlQueryService from "./db/load_wiki_html_query_service";
import loadWikiHTML from "./domain/load_wiki_html";
import registerFromIssues from "./domain/register_from_issues";
import printIssues from "./print_issues";

(async (): Promise<void> => {
  const newTracksHTML = await readFile("htmls/新曲リスト.html");
  const oldGFDMTracksHTML = await readFile("htmls/旧曲リスト_GFDM.html");
  const oldGDTracksHTML = await readFile("htmls/旧曲リスト_GD.html");

  const issues = await prismaClient.$transaction((tx) =>
    loadWikiHTML({
      newTracksHTML,
      oldGFDMTracksHTML,
      oldGDTracksHTML,
      dbQueryService: new LoadWikiHtmlQueryService(tx),
      trackRepository: new TrackRepository(tx),
    }),
  );

  if (issues.length === 0) {
    console.log("曲情報に変更はありませんでした。");
    return;
  }

  printIssues(issues);

  const errorExists = issues.some((i) => i.type === "error");
  if (errorExists) {
    return;
  }

  if (!(await confirmRegister())) {
    return;
  }

  // todo 件数が多すぎるなら分ける
  await prismaClient.$transaction(
    async (tx) => {
      const updatedTrackIds = await registerFromIssues(
        issues,
        new TrackRepository(tx),
      );

      await Promise.all(updatedTrackIds.map((id) => updateSkillPoint(tx, id)));
    },
    { timeout: 30000 },
  );
})().catch((e) => console.error(e));

function readFile(path: string): Promise<string> {
  return fs.promises.readFile(path, {
    encoding: "utf8",
  });
}

async function confirmRegister(): Promise<boolean> {
  const rl = readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const input = await rl.question("続行しますか? (y/n): ");

  return input === "y";
}
