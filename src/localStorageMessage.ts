import { LogMessageSeverity } from './LogMessageSeverity';
import { MethodSourceInfo } from './MethodSourceInfo';

export class LocalStorageMessage {
  constructor(
    public severity: LogMessageSeverity,
    public category: string,
    public caption: string,
    public description: string,
    public parameters: any[] | null = null,
    public exception: any | null = null,
    public details: string | null = null,
    public methodSourceInfo: MethodSourceInfo | null = null,
    public timestamp: any,
    public sequence: number,
    public agentSessionId: string,
    public sessionId: string,
  ) {}
}
