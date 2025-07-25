export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: string;
    children?: FileNode[];
}
export interface FileWatchEvent {
    event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
    path: string;
}
export declare class FileService {
    private readonly projectRoot;
    private isInitialized;
    private watcher;
    private watchCallback;
    private readonly ignorePatterns;
    constructor();
    private initialize;
    getFileTree(rootPath?: string): Promise<FileNode>;
    private buildFileTree;
    getFileContent(filePath: string): Promise<string>;
    saveFile(filePath: string, content: string, createDirectories?: boolean): Promise<{
        success: boolean;
        path: string;
        size: number;
    }>;
    deleteFile(filePath: string): Promise<{
        success: boolean;
        path: string;
    }>;
    createDirectory(dirPath: string): Promise<{
        success: boolean;
        path: string;
    }>;
    exists(filePath: string): Promise<boolean>;
    getFileStats(filePath: string): Promise<{
        size: number;
        modified: string;
        isDirectory: boolean;
    }>;
    startWatching(callback: (event: string, path: string) => void): void;
    stopWatching(): void;
    private shouldIgnore;
    isHealthy(): boolean;
    getStats(): {
        isInitialized: boolean;
        projectRoot: string;
        isWatching: boolean;
        ignorePatterns: string[];
    };
}
//# sourceMappingURL=file-service.d.ts.map