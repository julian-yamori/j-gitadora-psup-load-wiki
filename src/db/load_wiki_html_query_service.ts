import { PrismaTransaction } from "./prisma_client";

/** loadWikiHtml関数用のDB参照機能 */
export default class LoadWikiHtmlQueryService {
  constructor(public readonly prismaTransaction: PrismaTransaction) {}

  /**
   * 削除されていない曲のID・タイトルを全て取得
   * @returns キーが曲名、値が曲IDのマップ
   */
  async existingTracks(): Promise<Map<string, string>> {
    const found = await this.prismaTransaction.track.findMany({
      select: { id: true, title: true },
      where: { deleted: false },
    });
    return new Map(found.map(({ title, id }) => [title, id]));
  }
}
