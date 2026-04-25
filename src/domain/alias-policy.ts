import { aliasSchema, isReservedPath, normalizeAlias } from "../shared/validation";
import type { AliasRepository } from "./ports";

export class AliasPolicy {
  constructor(private readonly aliases: AliasRepository) {}

  async validate(alias: string): Promise<string> {
    const normalized = normalizeAlias(alias);
    aliasSchema.parse(normalized);

    if (isReservedPath(normalized) || (await this.aliases.isReserved(normalized))) {
      throw new Error("ALIAS_RESERVED");
    }

    return normalized;
  }
}
