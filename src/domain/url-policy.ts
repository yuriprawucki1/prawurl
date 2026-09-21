import { destinationUrlSchema, normalizeHostname } from "../shared/validation";
import type { BlockedDomainRepository } from "./ports";

export class UrlPolicy {
  constructor(private readonly blockedDomains: BlockedDomainRepository) {}

  async validate(destinationUrl: string): Promise<string> {
    const parsed = destinationUrlSchema.parse(destinationUrl);
    const hostname = normalizeHostname(new URL(parsed).hostname);

    if (hostname === "prawurl.com" || hostname.endsWith(".prawurl.com")) {
      throw new Error("DESTINATION_SELF_REFERENTIAL");
    }

    if (await this.blockedDomains.isBlocked(hostname)) {
      throw new Error("DESTINATION_BLOCKED");
    }

    return parsed;
  }
}
