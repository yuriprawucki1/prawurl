import type { AuditLogRepository } from "../domain/ports";
import type { AuditSeverity } from "../shared/contracts";

export class AuditService {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  write(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    return this.auditLogs.insert({
      id: crypto.randomUUID(),
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      severity: input.severity ?? "info",
      metadata: input.metadata ?? {},
      occurredAt: new Date().toISOString()
    });
  }
}
