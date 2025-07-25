"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const git_service_1 = require("./git-service");
class ProjectService {
    constructor() {
        this.isInitialized = false;
        this.buildProcess = null;
        this.previewProcess = null;
        this.previewPort = 3000;
        this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project';
        this.gitService = new git_service_1.GitService();
        this.initialize();
    }
    async initialize() {
        try {
            await promises_1.default.mkdir(this.projectRoot, { recursive: true });
            this.isInitialized = true;
            console.log('✅ Project service initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize Project service:', error);
        }
    }
    async createProject(request) {
        if (!this.isInitialized) {
            throw new Error('Project service not initialized');
        }
        try {
            const projectPath = path_1.default.join('/code/projects', request.name);
            await promises_1.default.mkdir(projectPath, { recursive: true });
            await this.createFromTemplate(projectPath, request.template);
            if (request.gitRepo) {
                await this.gitService.addRemote('origin', request.gitRepo);
            }
            const packageJson = await this.createPackageJson(request);
            await promises_1.default.writeFile(path_1.default.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
            return await this.getProjectStatusFromPath(projectPath);
        }
        catch (error) {
            console.error('Create project error:', error);
            throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async cloneProject(request) {
        if (!this.isInitialized) {
            throw new Error('Project service not initialized');
        }
        try {
            const cloneResult = await this.gitService.clone(request.gitUrl, undefined, request.branch);
            const newProjectRoot = cloneResult.path;
            const packageJsonPath = path_1.default.join(newProjectRoot, 'package.json');
            try {
                await promises_1.default.access(packageJsonPath);
                await this.installDependencies(newProjectRoot);
            }
            catch (error) {
                console.log('📦 No package.json found, skipping dependency installation');
            }
            return await this.getProjectStatusFromPath(newProjectRoot);
        }
        catch (error) {
            console.error('Clone project error:', error);
            throw new Error(`Failed to clone project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getProjectStatus() {
        if (!this.isInitialized) {
            throw new Error('Project service not initialized');
        }
        return await this.getProjectStatusFromPath(this.projectRoot);
    }
    async getProjectStatusFromPath(projectPath) {
        try {
            const packageJsonPath = path_1.default.join(projectPath, 'package.json');
            let packageJson = {};
            try {
                const content = await promises_1.default.readFile(packageJsonPath, 'utf-8');
                packageJson = JSON.parse(content);
            }
            catch (error) {
                console.log('📦 No package.json found or invalid JSON');
            }
            let hasGit = false;
            let gitBranch;
            try {
                const gitStatus = await this.gitService.getStatus();
                hasGit = true;
                gitBranch = gitStatus.branch;
            }
            catch (error) {
            }
            const packageManager = await this.detectPackageManager(projectPath);
            const projectName = packageJson.name || path_1.default.basename(projectPath);
            return {
                name: projectName,
                path: projectPath,
                type: this.detectProjectType(packageJson),
                hasGit,
                gitBranch,
                packageManager,
                scripts: Object.keys(packageJson.scripts || {}),
                dependencies: packageJson.dependencies || {},
                devDependencies: packageJson.devDependencies || {},
                previewUrl: this.previewProcess ? `http://localhost:${this.previewPort}` : undefined,
                previewStatus: this.previewProcess ? 'running' : 'stopped'
            };
        }
        catch (error) {
            console.error('Get project status error:', error);
            throw new Error(`Failed to get project status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async buildProject() {
        if (!this.isInitialized) {
            throw new Error('Project service not initialized');
        }
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let output = '';
            let errors = [];
            const packageManager = 'npm';
            const buildCommand = packageManager === 'npm' ? 'npm run build' :
                packageManager === 'yarn' ? 'yarn build' : 'pnpm build';
            console.log(`🔨 Starting build: ${buildCommand}`);
            this.buildProcess = (0, child_process_1.spawn)('sh', ['-c', buildCommand], {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            this.buildProcess.stdout?.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                console.log(chunk);
            });
            this.buildProcess.stderr?.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                errors.push(chunk);
                console.error(chunk);
            });
            this.buildProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                this.buildProcess = null;
                if (code === 0) {
                    console.log('✅ Build completed successfully');
                    resolve({
                        success: true,
                        duration,
                        output
                    });
                }
                else {
                    console.error('❌ Build failed');
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
            this.buildProcess.on('error', (error) => {
                this.buildProcess = null;
                console.error('❌ Build process error:', error);
                reject(new Error(`Build process error: ${error.message}`));
            });
        });
    }
    async startPreview() {
        if (!this.isInitialized) {
            throw new Error('Project service not initialized');
        }
        if (this.previewProcess) {
            await this.stopPreview();
        }
        return new Promise((resolve, reject) => {
            const packageManager = 'npm';
            const devCommand = packageManager === 'npm' ? 'npm run dev' :
                packageManager === 'yarn' ? 'yarn dev' : 'pnpm dev';
            console.log(`🚀 Starting preview: ${devCommand}`);
            this.previewProcess = (0, child_process_1.spawn)('sh', ['-c', devCommand], {
                cwd: this.projectRoot,
                stdio: 'pipe',
                env: {
                    ...process.env,
                    PORT: this.previewPort.toString()
                }
            });
            let hasStarted = false;
            this.previewProcess.stdout?.on('data', (data) => {
                const chunk = data.toString();
                console.log(chunk);
                if (!hasStarted && (chunk.includes('Local:') || chunk.includes('localhost:') || chunk.includes('ready'))) {
                    hasStarted = true;
                    resolve({
                        success: true,
                        url: `http://localhost:${this.previewPort}`,
                        port: this.previewPort,
                        pid: this.previewProcess?.pid
                    });
                }
            });
            this.previewProcess.stderr?.on('data', (data) => {
                const chunk = data.toString();
                console.error(chunk);
            });
            this.previewProcess.on('close', (code) => {
                console.log(`Preview process exited with code ${code}`);
                this.previewProcess = null;
            });
            this.previewProcess.on('error', (error) => {
                this.previewProcess = null;
                console.error('❌ Preview process error:', error);
                if (!hasStarted) {
                    reject(new Error(`Preview process error: ${error.message}`));
                }
            });
            setTimeout(() => {
                if (!hasStarted) {
                    this.stopPreview();
                    reject(new Error('Preview startup timeout'));
                }
            }, 30000);
        });
    }
    async stopPreview() {
        if (this.previewProcess) {
            console.log('🛑 Stopping preview server...');
            this.previewProcess.kill('SIGTERM');
            this.previewProcess = null;
        }
    }
    async createFromTemplate(projectPath, template) {
        const templatePath = '/code/baseline-project';
        try {
            await this.copyDirectory(templatePath, projectPath);
            console.log(`📁 Created project from ${template} template`);
        }
        catch (error) {
            await this.createMinimalNextProject(projectPath);
            console.log('📁 Created minimal Next.js project');
        }
    }
    async copyDirectory(src, dest) {
        await promises_1.default.mkdir(dest, { recursive: true });
        const entries = await promises_1.default.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path_1.default.join(src, entry.name);
            const destPath = path_1.default.join(dest, entry.name);
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            }
            else {
                await promises_1.default.copyFile(srcPath, destPath);
            }
        }
    }
    async createMinimalNextProject(projectPath) {
        const structure = [
            'app',
            'components',
            'lib',
            'public'
        ];
        for (const dir of structure) {
            await promises_1.default.mkdir(path_1.default.join(projectPath, dir), { recursive: true });
        }
        const files = {
            'app/page.tsx': `export default function Home() {
  return (
    <main>
      <h1>Welcome to your new project!</h1>
      <p>This project was created with Claude Code E2B integration.</p>
    </main>
  )
}`,
            'app/layout.tsx': `export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
            'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig`
        };
        for (const [filePath, content] of Object.entries(files)) {
            const fullPath = path_1.default.join(projectPath, filePath);
            await promises_1.default.mkdir(path_1.default.dirname(fullPath), { recursive: true });
            await promises_1.default.writeFile(fullPath, content);
        }
    }
    async createPackageJson(request) {
        return {
            name: request.name,
            version: '0.1.0',
            description: request.description || `A ${request.template} project created with Claude Code E2B`,
            scripts: {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
                lint: 'next lint'
            },
            dependencies: {
                next: '15.0.0',
                react: '19.0.0',
                'react-dom': '19.0.0'
            },
            devDependencies: {
                '@types/node': '^20',
                '@types/react': '^18',
                '@types/react-dom': '^18',
                eslint: '^8',
                'eslint-config-next': '15.0.0',
                typescript: '^5'
            }
        };
    }
    async detectPackageManager(projectPath) {
        try {
            await promises_1.default.access(path_1.default.join(projectPath, 'yarn.lock'));
            return 'yarn';
        }
        catch { }
        try {
            await promises_1.default.access(path_1.default.join(projectPath, 'pnpm-lock.yaml'));
            return 'pnpm';
        }
        catch { }
        return 'npm';
    }
    detectProjectType(packageJson) {
        if (packageJson.dependencies?.next)
            return 'nextjs';
        if (packageJson.dependencies?.react)
            return 'react';
        if (packageJson.dependencies?.vue)
            return 'vue';
        return 'unknown';
    }
    async installDependencies(projectPath) {
        return new Promise((resolve, reject) => {
            const packageManager = 'npm';
            const installCommand = packageManager === 'npm' ? 'npm install' :
                packageManager === 'yarn' ? 'yarn install' : 'pnpm install';
            console.log(`📦 Installing dependencies: ${installCommand}`);
            const installProcess = (0, child_process_1.spawn)('sh', ['-c', installCommand], {
                cwd: projectPath,
                stdio: 'pipe'
            });
            installProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Dependencies installed successfully');
                    resolve();
                }
                else {
                    reject(new Error(`Dependency installation failed with code ${code}`));
                }
            });
            installProcess.on('error', (error) => {
                reject(new Error(`Dependency installation error: ${error.message}`));
            });
        });
    }
    isHealthy() {
        return this.isInitialized;
    }
    getStats() {
        return {
            isInitialized: this.isInitialized,
            projectRoot: this.projectRoot,
            hasBuildProcess: !!this.buildProcess,
            hasPreviewProcess: !!this.previewProcess,
            previewPort: this.previewPort
        };
    }
}
exports.ProjectService = ProjectService;
//# sourceMappingURL=project-service.js.map