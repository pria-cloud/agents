export interface GeneratedFile {
    filePath: string;
    content: string;
    operation?: string;
}
export interface E2BSandboxConfig {
    templateId: string;
    teamId: string;
    workspaceId: string;
    conversationId: string;
}
export interface SandboxInfo {
    sandboxId: string;
    sandboxUrl: string;
    status: 'creating' | 'ready' | 'failed';
    createdAt: string;
}
export declare class E2BSandboxService {
    private readonly templateId;
    private readonly teamId;
    private readonly eventService;
    constructor(templateId?: string, teamId?: string);
    /**
     * Creates a new E2B sandbox and injects the generated files
     */
    createSandbox(files: GeneratedFile[], dependencies: string[], config: E2BSandboxConfig): Promise<SandboxInfo>;
    /**
     * Injects generated files into the sandbox
     */
    private injectFiles;
    /**
     * Updates package.json with additional dependencies
     */
    private updateDependencies;
    /**
     * Installs dependencies in the sandbox
     */
    private installDependencies;
    /**
     * Starts the development server
     */
    private startDevServer;
    /**
     * Stores sandbox information in Supabase
     */
    private storeSandboxInfo;
    /**
     * Retrieves sandbox information from Supabase
     */
    getSandboxInfo(conversationId: string, workspaceId: string): Promise<SandboxInfo | null>;
}
//# sourceMappingURL=e2bSandboxService.d.ts.map