"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const chokidar_1 = __importDefault(require("chokidar"));
class FileService {
    constructor() {
        this.isInitialized = false;
        this.watcher = null;
        this.watchCallback = null;
        this.ignorePatterns = [
            '**/node_modules/**',
            '**/.git/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**',
            '**/.env*',
            '**/coverage/**',
            '**/*.log',
            '**/tmp/**',
            '**/temp/**'
        ];
        this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project';
        this.initialize();
    }
    async initialize() {
        try {
            await promises_1.default.mkdir(this.projectRoot, { recursive: true });
            this.isInitialized = true;
            console.log('✅ File service initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize File service:', error);
        }
    }
    async getFileTree(rootPath) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        const targetPath = rootPath || this.projectRoot;
        return await this.buildFileTree(targetPath);
    }
    async buildFileTree(dirPath) {
        try {
            const stats = await promises_1.default.stat(dirPath);
            const name = path_1.default.basename(dirPath);
            if (stats.isFile()) {
                return {
                    name,
                    path: dirPath,
                    type: 'file',
                    size: stats.size,
                    modified: stats.mtime.toISOString()
                };
            }
            const children = [];
            try {
                const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const entryPath = path_1.default.join(dirPath, entry.name);
                    if (this.shouldIgnore(entryPath)) {
                        continue;
                    }
                    if (entry.isDirectory()) {
                        const childNode = await this.buildFileTree(entryPath);
                        children.push(childNode);
                    }
                    else {
                        const childStats = await promises_1.default.stat(entryPath);
                        children.push({
                            name: entry.name,
                            path: entryPath,
                            type: 'file',
                            size: childStats.size,
                            modified: childStats.mtime.toISOString()
                        });
                    }
                }
            }
            catch (error) {
                console.warn(`Cannot read directory ${dirPath}:`, error);
            }
            children.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
            return {
                name,
                path: dirPath,
                type: 'directory',
                children
            };
        }
        catch (error) {
            console.error(`Error building file tree for ${dirPath}:`, error);
            throw new Error(`Failed to build file tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getFileContent(filePath) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        try {
            const fullPath = path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(this.projectRoot, filePath);
            const resolvedPath = path_1.default.resolve(fullPath);
            const resolvedRoot = path_1.default.resolve(this.projectRoot);
            if (!resolvedPath.startsWith(resolvedRoot)) {
                throw new Error('Access denied: Path outside project root');
            }
            const content = await promises_1.default.readFile(resolvedPath, 'utf-8');
            return content;
        }
        catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async saveFile(filePath, content, createDirectories = true) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        try {
            const fullPath = path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(this.projectRoot, filePath);
            const resolvedPath = path_1.default.resolve(fullPath);
            const resolvedRoot = path_1.default.resolve(this.projectRoot);
            if (!resolvedPath.startsWith(resolvedRoot)) {
                throw new Error('Access denied: Path outside project root');
            }
            if (createDirectories) {
                const dirPath = path_1.default.dirname(resolvedPath);
                await promises_1.default.mkdir(dirPath, { recursive: true });
            }
            await promises_1.default.writeFile(resolvedPath, content, 'utf-8');
            const stats = await promises_1.default.stat(resolvedPath);
            return {
                success: true,
                path: resolvedPath,
                size: stats.size
            };
        }
        catch (error) {
            console.error(`Error saving file ${filePath}:`, error);
            throw new Error(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async deleteFile(filePath) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        try {
            const fullPath = path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(this.projectRoot, filePath);
            const resolvedPath = path_1.default.resolve(fullPath);
            const resolvedRoot = path_1.default.resolve(this.projectRoot);
            if (!resolvedPath.startsWith(resolvedRoot)) {
                throw new Error('Access denied: Path outside project root');
            }
            const stats = await promises_1.default.stat(resolvedPath);
            if (stats.isDirectory()) {
                await promises_1.default.rmdir(resolvedPath, { recursive: true });
            }
            else {
                await promises_1.default.unlink(resolvedPath);
            }
            return {
                success: true,
                path: resolvedPath
            };
        }
        catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
            throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createDirectory(dirPath) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        try {
            const fullPath = path_1.default.isAbsolute(dirPath) ? dirPath : path_1.default.join(this.projectRoot, dirPath);
            const resolvedPath = path_1.default.resolve(fullPath);
            const resolvedRoot = path_1.default.resolve(this.projectRoot);
            if (!resolvedPath.startsWith(resolvedRoot)) {
                throw new Error('Access denied: Path outside project root');
            }
            await promises_1.default.mkdir(resolvedPath, { recursive: true });
            return {
                success: true,
                path: resolvedPath
            };
        }
        catch (error) {
            console.error(`Error creating directory ${dirPath}:`, error);
            throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async exists(filePath) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        try {
            const fullPath = path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(this.projectRoot, filePath);
            await promises_1.default.access(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getFileStats(filePath) {
        if (!this.isInitialized) {
            throw new Error('File service not initialized');
        }
        try {
            const fullPath = path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(this.projectRoot, filePath);
            const stats = await promises_1.default.stat(fullPath);
            return {
                size: stats.size,
                modified: stats.mtime.toISOString(),
                isDirectory: stats.isDirectory()
            };
        }
        catch (error) {
            console.error(`Error getting file stats ${filePath}:`, error);
            throw new Error(`Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    startWatching(callback) {
        if (!this.isInitialized) {
            console.warn('⚠️ File service not initialized, skipping file watching');
            return;
        }
        if (this.watcher) {
            this.stopWatching();
        }
        this.watchCallback = callback;
        this.watcher = chokidar_1.default.watch(this.projectRoot, {
            ignored: this.ignorePatterns,
            persistent: true,
            ignoreInitial: true,
            followSymlinks: false,
            depth: 10,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });
        this.watcher
            .on('add', (path) => callback('add', path))
            .on('change', (path) => callback('change', path))
            .on('unlink', (path) => callback('unlink', path))
            .on('addDir', (path) => callback('addDir', path))
            .on('unlinkDir', (path) => callback('unlinkDir', path))
            .on('error', (error) => console.error('File watcher error:', error));
        console.log('👀 File watching started');
    }
    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('👁️ File watching stopped');
        }
        this.watchCallback = null;
    }
    shouldIgnore(filePath) {
        const relativePath = path_1.default.relative(this.projectRoot, filePath);
        return this.ignorePatterns.some(pattern => {
            const regexPattern = pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(relativePath);
        });
    }
    isHealthy() {
        return this.isInitialized;
    }
    getStats() {
        return {
            isInitialized: this.isInitialized,
            projectRoot: this.projectRoot,
            isWatching: !!this.watcher,
            ignorePatterns: this.ignorePatterns
        };
    }
}
exports.FileService = FileService;
//# sourceMappingURL=file-service.js.map