"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2BSandboxService = void 0;
const e2b_1 = require("e2b");
const logger_1 = require("./logger");
const supabase_1 = require("./supabase");
const sandboxEventService_1 = require("./sandboxEventService");
class E2BSandboxService {
    templateId;
    teamId;
    eventService;
    constructor(templateId, teamId) {
        this.templateId = templateId || process.env.E2B_TEMPLATE_ID || 'bslm087lozmkvjz6nwle';
        this.teamId = teamId || process.env.E2B_TEAM_ID || 'd9ae965a-2a35-4a01-bc6e-6ff76faaa12c';
        this.eventService = new sandboxEventService_1.SandboxEventService();
        logger_1.logger.info({
            event: 'e2b.service.init',
            templateId: this.templateId,
            teamId: this.teamId,
            usingEnvVars: {
                template: !!process.env.E2B_TEMPLATE_ID,
                team: !!process.env.E2B_TEAM_ID
            }
        }, 'E2B Sandbox Service initialized');
    }
    /**
     * Creates a new E2B sandbox and injects the generated files
     */
    async createSandbox(files, dependencies, config) {
        const startTime = Date.now();
        try {
            logger_1.logger.info({
                event: 'e2b.sandbox.creating',
                conversationId: config.conversationId,
                filesCount: files.length,
                templateId: this.templateId
            }, 'Creating E2B sandbox');
            // Broadcast sandbox creation started event
            await this.eventService.broadcastSandboxCreating(config.conversationId, config.workspaceId, 'Creating live preview sandbox...');
            // Create sandbox instance
            const sandbox = await e2b_1.Sandbox.create(this.templateId, {
                timeoutMs: 300000, // 5 minutes timeout
            });
            const sandboxId = sandbox.sandboxId;
            logger_1.logger.info({
                event: 'e2b.sandbox.created',
                sandboxId,
                conversationId: config.conversationId,
                creationTime: Date.now() - startTime
            }, 'E2B sandbox created');
            // Inject files into sandbox
            await this.injectFiles(sandbox, files);
            // Update package.json dependencies if needed
            await this.updateDependencies(sandbox, dependencies);
            // Install dependencies
            await this.installDependencies(sandbox);
            // Note: shadcn components are installed by start-sandbox.sh startup script
            // No need to install them here as it causes redundant installation failures
            // Start the development server
            await this.startDevServer(sandbox);
            const sandboxUrl = `https://${sandboxId}.e2b.dev`;
            const sandboxInfo = {
                sandboxId,
                sandboxUrl,
                status: 'ready',
                createdAt: new Date().toISOString()
            };
            // Store sandbox info in Supabase
            await this.storeSandboxInfo(config, sandboxInfo);
            // Broadcast sandbox ready event
            await this.eventService.broadcastSandboxReady(config.conversationId, config.workspaceId, sandboxId, sandboxUrl, 'Live preview ready');
            logger_1.logger.info({
                event: 'e2b.sandbox.ready',
                sandboxId,
                sandboxUrl,
                conversationId: config.conversationId,
                totalTime: Date.now() - startTime
            }, 'E2B sandbox ready');
            return sandboxInfo;
        }
        catch (error) {
            logger_1.logger.error({
                event: 'e2b.sandbox.error',
                error: error instanceof Error ? error.message : String(error),
                conversationId: config.conversationId,
                templateId: this.templateId
            }, 'Failed to create E2B sandbox');
            // Broadcast sandbox failed event
            await this.eventService.broadcastSandboxFailed(config.conversationId, config.workspaceId, error instanceof Error ? error.message : String(error), 'Live preview creation failed');
            throw new Error(`Failed to create E2B sandbox: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Injects generated files into the sandbox
     */
    async injectFiles(sandbox, files) {
        logger_1.logger.info({
            event: 'e2b.files.injecting',
            filesCount: files.length,
            sandboxId: sandbox.sandboxId
        }, 'Injecting files into sandbox');
        for (const file of files) {
            try {
                // Ensure directory exists
                const dirPath = file.filePath.split('/').slice(0, -1).join('/');
                if (dirPath) {
                    await sandbox.files.makeDir(dirPath);
                }
                // Write file content
                await sandbox.files.write(file.filePath, file.content);
                logger_1.logger.debug({
                    event: 'e2b.file.injected',
                    filePath: file.filePath,
                    sandboxId: sandbox.sandboxId
                }, 'File injected');
            }
            catch (error) {
                logger_1.logger.error({
                    event: 'e2b.file.error',
                    filePath: file.filePath,
                    error: error instanceof Error ? error.message : String(error),
                    sandboxId: sandbox.sandboxId
                }, 'Failed to inject file');
                // Continue with other files even if one fails
            }
        }
    }
    /**
     * Updates package.json with additional dependencies
     */
    async updateDependencies(sandbox, dependencies) {
        if (dependencies.length === 0)
            return;
        try {
            logger_1.logger.info({
                event: 'e2b.dependencies.updating',
                dependencies,
                sandboxId: sandbox.sandboxId
            }, 'Updating dependencies');
            // Read existing package.json
            const packageJsonContent = await sandbox.files.read('/code/package.json');
            const packageJson = JSON.parse(packageJsonContent);
            // Add new dependencies
            for (const dep of dependencies) {
                const [name, version] = dep.includes('@') ? dep.split('@') : [dep, 'latest'];
                packageJson.dependencies[name] = version;
            }
            // Write updated package.json
            await sandbox.files.write('/code/package.json', JSON.stringify(packageJson, null, 2));
        }
        catch (error) {
            logger_1.logger.error({
                event: 'e2b.dependencies.error',
                error: error instanceof Error ? error.message : String(error),
                sandboxId: sandbox.sandboxId
            }, 'Failed to update dependencies');
        }
    }
    /**
     * Installs dependencies in the sandbox
     */
    async installDependencies(sandbox) {
        try {
            logger_1.logger.info({
                event: 'e2b.dependencies.installing',
                sandboxId: sandbox.sandboxId
            }, 'Installing dependencies');
            const result = await sandbox.commands.run('npm install --legacy-peer-deps', {
                cwd: '/code',
                timeoutMs: 180000 // 3 minutes for better compatibility
            });
            if (result.exitCode !== 0) {
                logger_1.logger.warn({
                    event: 'e2b.dependencies.warning',
                    exitCode: result.exitCode,
                    stderr: result.stderr,
                    stdout: result.stdout,
                    sandboxId: sandbox.sandboxId
                }, 'Dependencies installation completed with warnings');
            }
            else {
                logger_1.logger.info({
                    event: 'e2b.dependencies.success',
                    sandboxId: sandbox.sandboxId
                }, 'Dependencies installed successfully');
            }
        }
        catch (error) {
            logger_1.logger.error({
                event: 'e2b.dependencies.install.error',
                error: error instanceof Error ? error.message : String(error),
                sandboxId: sandbox.sandboxId
            }, 'Failed to install dependencies');
            // Don't throw error, continue with other setup steps
        }
    }
    /**
     * Starts the development server
     */
    async startDevServer(sandbox) {
        try {
            logger_1.logger.info({
                event: 'e2b.server.starting',
                sandboxId: sandbox.sandboxId
            }, 'Starting development server');
            // Start dev server in background
            sandbox.commands.run('npm run dev', {
                cwd: '/code',
                background: true
            });
            // Wait a bit for server to start
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        catch (error) {
            logger_1.logger.error({
                event: 'e2b.server.error',
                error: error instanceof Error ? error.message : String(error),
                sandboxId: sandbox.sandboxId
            }, 'Failed to start development server');
        }
    }
    /**
     * Stores sandbox information in Supabase
     */
    async storeSandboxInfo(config, sandboxInfo) {
        try {
            const { error } = await supabase_1.supabase
                .from('sandbox_instances')
                .insert({
                workspace_id: config.workspaceId,
                conversation_id: config.conversationId,
                sandbox_id: sandboxInfo.sandboxId,
                sandbox_url: sandboxInfo.sandboxUrl,
                status: sandboxInfo.status,
                template_id: this.templateId,
                created_at: sandboxInfo.createdAt
            });
            if (error) {
                logger_1.logger.error({
                    event: 'e2b.storage.error',
                    error: error instanceof Error ? error.message : String(error),
                    sandboxId: sandboxInfo.sandboxId
                }, 'Failed to store sandbox info');
            }
        }
        catch (error) {
            logger_1.logger.error({
                event: 'e2b.storage.error',
                error: error instanceof Error ? error.message : String(error),
                sandboxId: sandboxInfo.sandboxId
            }, 'Failed to store sandbox info');
        }
    }
    /**
     * Retrieves sandbox information from Supabase
     */
    async getSandboxInfo(conversationId, workspaceId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('sandbox_instances')
                .select('*')
                .eq('conversation_id', conversationId)
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (error || !data) {
                return null;
            }
            return {
                sandboxId: data.sandbox_id,
                sandboxUrl: data.sandbox_url,
                status: data.status,
                createdAt: data.created_at
            };
        }
        catch (error) {
            logger_1.logger.error({
                event: 'e2b.retrieval.error',
                error: error instanceof Error ? error.message : String(error),
                conversationId
            }, 'Failed to retrieve sandbox info');
            return null;
        }
    }
}
exports.E2BSandboxService = E2BSandboxService;
//# sourceMappingURL=e2bSandboxService.js.map