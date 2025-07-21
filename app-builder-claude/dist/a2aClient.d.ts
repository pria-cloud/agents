export interface AgentRegistration {
    agent_name: string;
    version: string;
    capabilities: string[];
    endpoint_url: string;
    supports_mcp: boolean;
}
export interface IntentMessage {
    intent: string;
    trace_id?: string;
    jwt?: string;
    [key: string]: any;
}
export declare function registerAgent(registration: AgentRegistration): Promise<any>;
export declare function sendIntent(msg: IntentMessage): Promise<any>;
export declare class A2AClient {
    constructor();
    registerAgent(registration: AgentRegistration): Promise<any>;
    sendIntent(msg: IntentMessage): Promise<any>;
}
//# sourceMappingURL=a2aClient.d.ts.map