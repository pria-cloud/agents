"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class GitService {
    constructor() {
        this.git = null;
        this.isInitialized = false;
        this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project';
        this.initialize();
    }
    async initialize() {
        try {
            await promises_1.default.mkdir(this.projectRoot, { recursive: true });
            this.git = (0, simple_git_1.default)(this.projectRoot);
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                console.log('📁 Initializing git repository...');
                await this.git.init();
                try {
                    await this.git.addConfig('user.name', 'Claude Code E2B');
                    await this.git.addConfig('user.email', 'claude@anthropic.com');
                }
                catch (error) {
                }
            }
            this.isInitialized = true;
            console.log('✅ Git service initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize Git service:', error);
            console.warn('⚠️ Git service will have limited functionality');
        }
    }
    async commit(request) {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            if (request.author) {
                await this.git.addConfig('user.name', request.author.name, false, 'local');
                await this.git.addConfig('user.email', request.author.email, false, 'local');
            }
            if (request.files && request.files.length > 0) {
                for (const file of request.files) {
                    await this.git.add(file);
                }
            }
            else {
                await this.git.add('.');
            }
            const status = await this.git.status();
            const stagedCount = status.staged.length;
            if (stagedCount === 0) {
                throw new Error('No changes to commit');
            }
            const result = await this.git.commit(request.message);
            return {
                hash: result.commit,
                message: request.message,
                filesCommitted: stagedCount
            };
        }
        catch (error) {
            console.error('Git commit error:', error);
            throw new Error(`Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async push(remote = 'origin', branch) {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            if (!branch) {
                const status = await this.git.status();
                branch = status.current || 'main';
            }
            const result = await this.git.push(remote, branch);
            return {
                success: true,
                details: `Successfully pushed to ${remote}/${branch}`
            };
        }
        catch (error) {
            console.error('Git push error:', error);
            throw new Error(`Failed to push: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async pull(remote = 'origin', branch) {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            if (!branch) {
                const status = await this.git.status();
                branch = status.current || 'main';
            }
            const result = await this.git.pull(remote, branch);
            return {
                success: true,
                changes: result.files.length
            };
        }
        catch (error) {
            console.error('Git pull error:', error);
            throw new Error(`Failed to pull: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getStatus() {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            const status = await this.git.status();
            return {
                branch: status.current || 'unknown',
                ahead: status.ahead,
                behind: status.behind,
                staged: status.staged,
                modified: status.modified,
                untracked: status.not_added,
                conflicts: status.conflicted
            };
        }
        catch (error) {
            console.error('Git status error:', error);
            throw new Error(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async manageBranch(request) {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            switch (request.action) {
                case 'create':
                    await this.git.checkoutLocalBranch(request.name);
                    break;
                case 'switch':
                    await this.git.checkout(request.name);
                    break;
                case 'create_and_switch':
                    if (request.from) {
                        await this.git.checkoutBranch(request.name, request.from);
                    }
                    else {
                        await this.git.checkoutLocalBranch(request.name);
                    }
                    break;
                default:
                    throw new Error(`Unknown branch action: ${request.action}`);
            }
            const status = await this.git.status();
            return {
                success: true,
                currentBranch: status.current || request.name
            };
        }
        catch (error) {
            console.error('Git branch error:', error);
            throw new Error(`Failed to manage branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getBranches() {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            const branches = await this.git.branch(['-a']);
            return {
                current: branches.current,
                all: branches.all.filter(b => !b.startsWith('remotes/')),
                remote: branches.all.filter(b => b.startsWith('remotes/'))
            };
        }
        catch (error) {
            console.error('Git branches error:', error);
            throw new Error(`Failed to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getCommitHistory(limit = 10) {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            const log = await this.git.log({ maxCount: limit });
            return log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: commit.author_name,
                date: commit.date
            }));
        }
        catch (error) {
            console.error('Git history error:', error);
            throw new Error(`Failed to get commit history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async clone(gitUrl, directory, branch) {
        try {
            const targetPath = directory || path_1.default.join('/code/repos', path_1.default.basename(gitUrl, '.git'));
            await promises_1.default.mkdir(path_1.default.dirname(targetPath), { recursive: true });
            await (0, simple_git_1.default)().clone(gitUrl, targetPath, branch ? ['--branch', branch] : undefined);
            return {
                success: true,
                path: targetPath
            };
        }
        catch (error) {
            console.error('Git clone error:', error);
            throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async addRemote(name, url) {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            await this.git.addRemote(name, url);
            return { success: true };
        }
        catch (error) {
            console.error('Git add remote error:', error);
            throw new Error(`Failed to add remote: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getRemotes() {
        if (!this.isInitialized || !this.git) {
            throw new Error('Git service not initialized');
        }
        try {
            const remotes = await this.git.getRemotes(true);
            return remotes.map(remote => ({
                name: remote.name,
                url: remote.refs.fetch || remote.refs.push
            }));
        }
        catch (error) {
            console.error('Git remotes error:', error);
            throw new Error(`Failed to get remotes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    isHealthy() {
        return this.isInitialized && !!this.git;
    }
    getStats() {
        return {
            isInitialized: this.isInitialized,
            projectRoot: this.projectRoot
        };
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git-service.js.map