import type { User } from "../shared/contracts";

export class AdminPolicy {
  assertAdmin(user: User): void {
    if (user.role !== "admin") {
      throw new Error("FORBIDDEN");
    }
  }

  assertActive(user: User): void {
    if (user.status !== "active") {
      throw new Error("USER_BLOCKED");
    }
  }
}
