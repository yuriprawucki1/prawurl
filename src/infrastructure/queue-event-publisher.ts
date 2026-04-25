import type { AppEvent } from "../shared/contracts";
import type { EventPublisher } from "../domain/ports";

export class QueueEventPublisher implements EventPublisher {
  constructor(private readonly queue: Queue<AppEvent>) {}

  async publish(event: AppEvent): Promise<void> {
    await this.queue.send(event);
  }
}
