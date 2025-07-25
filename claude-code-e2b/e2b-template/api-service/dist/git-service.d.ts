export interface CommitRequest {
    message: string;
    files?: string[];
    author?: {
        name: string;
        email: string;
    };
}
export interface BranchRequest {
    name: string;
    action: 'create' | 'switch' | 'create_and_switch';
    from?: string;
}
export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    modified: string[];
    untracked: string[];
    conflicts: string[];
}
export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}
export declare class GitService {
    private git;
    private readonly projectRoot;
    private isInitialized;
    constructor();
    private initialize;
    commit(request: CommitRequest): Promise<{
        hash: string;
        message: string;
        filesCommitted: number;
    }>;
    push(remote?: string, branch?: string): Promise<{
        success: boolean;
        details: string;
    }>;
    pull(remote?: string, branch?: string): Promise<{
        success: boolean;
        changes: number;
    }>;
    getStatus(): Promise<GitStatus>;
    manageBranch(request: BranchRequest): Promise<{
        success: boolean;
        currentBranch: string;
    }>;
    getBranches(): Promise<{
        current: string;
        all: string[];
        remote: string[];
    }>;
    getCommitHistory(limit?: number): Promise<CommitInfo[]>;
    clone(gitUrl: string, directory?: string, branch?: string): Promise<{
        success: boolean;
        path: string;
    }>;
    addRemote(name: string, url: string): Promise<{
        success: boolean;
    }>;
    getRemotes(): Promise<Array<{
        name: string;
        url: string;
    }>>;
    isHealthy(): boolean;
    getStats(): {
        isInitialized: boolean;
        projectRoot: string;
    };
}
//# sourceMappingURL=git-service.d.ts.map