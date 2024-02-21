import neverError from "j-gitadora-psup/src/utils/never_error";
import { TrackDiffirence, WikiLoadingIssue } from "./domain/wiki_loading_issue";
import { WikiLoadingSource } from "./domain/wiki_loading_source";
import { difficultyToStr } from "j-gitadora-psup/src/domain/track/difficulty";

export default function printIssues(
  issues: ReadonlyArray<WikiLoadingIssue>,
): void {
  for (const issue of issues) {
    const { type } = issue;

    switch (type) {
      case "new":
        console.log(`add: ${issue.newTrack.title} ${displayPosition(issue)}`);
        break;

      case "diff":
        console.log(`diff: ${issue.newTrack.title} ${displayPosition(issue)}`);
        for (const diff of issue.diffirences) {
          console.log(`  ${displayDiff(diff)}`);
        }
        break;

      case "delete":
        console.log(`delete: ${issue.title}`);
        break;

      case "error":
        console.log(`error: ${displayPosition(issue)}`);
        console.log(`  ${issue.message}`);
        break;

      default:
        throw neverError(type);
    }
  }
}

function displayPosition({
  source,
  rowNo,
}: {
  source: WikiLoadingSource;
  rowNo: number | undefined;
}): string {
  let result = `@${sourceToViewText(source)}`;
  if (rowNo !== undefined) {
    result += ` (${rowNo})`;
  }

  return result;
}

function displayDiff(diff: TrackDiffirence): string {
  let result = `${diff.propertyName} : ${diff.oldValue ?? "-"} -> ${diff.newValue ?? "-"}`;

  if (diff.difficulty !== undefined) {
    result = `${difficultyToStr(diff.difficulty)} ${result}`;
  }

  return result;
}

function sourceToViewText(source: WikiLoadingSource): string {
  switch (source) {
    case "new":
      return "新曲リスト";
    case "old_GFDM":
      return "旧曲リスト 初代〜XG3";
    case "old_GD":
      return "旧曲リスト GITADORA";
    default:
      throw neverError(source);
  }
}
