export interface CreateProjectRequest {
    name: string;
    template: 'nextjs' | 'react' | 'vue' | 'custom';
    gitRepo?: string;
    description?: string;
}
export interface CloneProjectRequest {
    gitUrl: string;
    branch?: string;
    credentials?: {
        token: string;
        type: 'github' | 'gitlab' | 'custom';
    };
}
export interface ProjectStatus {
    name: string;
    path: string;
    type: string;
    hasGit: boolean;
    gitBranch?: string;
    packageManager: 'npm' | 'yarn' | 'pnpm';
    scripts: string[];
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    buildStatus?: 'building' | 'success' | 'error';
    previewStatus?: 'starting' | 'running' | 'stopped' | 'error';
    previewUrl?: string;
}
export interface BuildResult {
    success: boolean;
    duration: number;
    output: string;
    errors?: string[];
}
export interface PreviewResult {
    success: boolean;
    url: string;
    port: number;
    pid?: number;
}
export declare class ProjectService {
    private readonly projectRoot;
    private readonly gitService;
    private isInitialized;
    private buildProcess;
    private previewProcess;
    private previewPort;
    constructor();
    private initialize;
    createProject(request: CreateProjectRequest): Promise<ProjectStatus>;
    cloneProject(request: CloneProjectRequest): Promise<ProjectStatus>;
    getProjectStatus(): Promise<ProjectStatus>;
    private getProjectStatusFromPath;
    buildProject(): Promise<BuildResult>;
    startPreview(): Promise<PreviewResult>;
    stopPreview(): Promise<void>;
    private createFromTemplate;
    private copyDirectory;
    private createMinimalNextProject;
    private createPackageJson;
    private detectPackageManager;
    private detectProjectType;
    private installDependencies;
    isHealthy(): boolean;
    getStats(): {
        isInitialized: boolean;
        projectRoot: string;
        hasBuildProcess: boolean;
        hasPreviewProcess: boolean;
        previewPort: number;
    };
}
//# sourceMappingURL=project-service.d.ts.map