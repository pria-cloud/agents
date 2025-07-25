import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  children?: FileNode[]
}

export interface FileWatchEvent {
  event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

export class FileService {
  private readonly projectRoot: string
  private isInitialized: boolean = false
  private watcher: chokidar.FSWatcher | null = null
  private watchCallback: ((event: string, path: string) => void) | null = null

  // Patterns to ignore
  private readonly ignorePatterns = [
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
  ]

  constructor() {
    this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project'
    this.initialize()
  }

  private async initialize() {
    try {
      // Ensure project directory exists
      await fs.mkdir(this.projectRoot, { recursive: true })
      
      this.isInitialized = true
      console.log('✅ File service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize File service:', error)
    }
  }

  async getFileTree(rootPath?: string): Promise<FileNode> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    const targetPath = rootPath || this.projectRoot
    return await this.buildFileTree(targetPath)
  }

  private async buildFileTree(dirPath: string): Promise<FileNode> {
    try {
      const stats = await fs.stat(dirPath)
      const name = path.basename(dirPath)

      if (stats.isFile()) {
        return {
          name,
          path: dirPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtime.toISOString()
        }
      }

      const children: FileNode[] = []
      
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name)
          
          // Skip ignored patterns
          if (this.shouldIgnore(entryPath)) {
            continue
          }

          if (entry.isDirectory()) {
            const childNode = await this.buildFileTree(entryPath)
            children.push(childNode)
          } else {
            const childStats = await fs.stat(entryPath)
            children.push({
              name: entry.name,
              path: entryPath,
              type: 'file',
              size: childStats.size,
              modified: childStats.mtime.toISOString()
            })
          }
        }
      } catch (error) {
        // Directory might not be readable, continue with empty children
        console.warn(`Cannot read directory ${dirPath}:`, error)
      }

      // Sort children: directories first, then files, both alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return {
        name,
        path: dirPath,
        type: 'directory',
        children
      }
    } catch (error) {
      console.error(`Error building file tree for ${dirPath}:`, error)
      throw new Error(`Failed to build file tree: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    try {
      // Resolve path relative to project root
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath)
      
      // Security check: ensure path is within project root
      const resolvedPath = path.resolve(fullPath)
      const resolvedRoot = path.resolve(this.projectRoot)
      
      if (!resolvedPath.startsWith(resolvedRoot)) {
        throw new Error('Access denied: Path outside project root')
      }

      const content = await fs.readFile(resolvedPath, 'utf-8')
      return content
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error)
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async saveFile(filePath: string, content: string, createDirectories: boolean = true): Promise<{ success: boolean; path: string; size: number }> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    try {
      // Resolve path relative to project root
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath)
      
      // Security check: ensure path is within project root
      const resolvedPath = path.resolve(fullPath)
      const resolvedRoot = path.resolve(this.projectRoot)
      
      if (!resolvedPath.startsWith(resolvedRoot)) {
        throw new Error('Access denied: Path outside project root')
      }

      // Create directories if requested
      if (createDirectories) {
        const dirPath = path.dirname(resolvedPath)
        await fs.mkdir(dirPath, { recursive: true })
      }

      // Write file
      await fs.writeFile(resolvedPath, content, 'utf-8')
      
      // Get file size
      const stats = await fs.stat(resolvedPath)

      return {
        success: true,
        path: resolvedPath,
        size: stats.size
      }
    } catch (error) {
      console.error(`Error saving file ${filePath}:`, error)
      throw new Error(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteFile(filePath: string): Promise<{ success: boolean; path: string }> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    try {
      // Resolve path relative to project root
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath)
      
      // Security check: ensure path is within project root
      const resolvedPath = path.resolve(fullPath)
      const resolvedRoot = path.resolve(this.projectRoot)
      
      if (!resolvedPath.startsWith(resolvedRoot)) {
        throw new Error('Access denied: Path outside project root')
      }

      // Check if it's a file or directory
      const stats = await fs.stat(resolvedPath)
      
      if (stats.isDirectory()) {
        await fs.rmdir(resolvedPath, { recursive: true })
      } else {
        await fs.unlink(resolvedPath)
      }

      return {
        success: true,
        path: resolvedPath
      }
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error)
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createDirectory(dirPath: string): Promise<{ success: boolean; path: string }> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    try {
      // Resolve path relative to project root
      const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.projectRoot, dirPath)
      
      // Security check: ensure path is within project root
      const resolvedPath = path.resolve(fullPath)
      const resolvedRoot = path.resolve(this.projectRoot)
      
      if (!resolvedPath.startsWith(resolvedRoot)) {
        throw new Error('Access denied: Path outside project root')
      }

      await fs.mkdir(resolvedPath, { recursive: true })

      return {
        success: true,
        path: resolvedPath
      }
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new Error(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async exists(filePath: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  async getFileStats(filePath: string): Promise<{ size: number; modified: string; isDirectory: boolean }> {
    if (!this.isInitialized) {
      throw new Error('File service not initialized')
    }

    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath)
      const stats = await fs.stat(fullPath)

      return {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory()
      }
    } catch (error) {
      console.error(`Error getting file stats ${filePath}:`, error)
      throw new Error(`Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  startWatching(callback: (event: string, path: string) => void): void {
    if (!this.isInitialized) {
      console.warn('⚠️ File service not initialized, skipping file watching')
      return
    }

    if (this.watcher) {
      this.stopWatching()
    }

    this.watchCallback = callback

    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: this.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 10, // Limit depth to prevent excessive watching
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    this.watcher
      .on('add', (path) => callback('add', path))
      .on('change', (path) => callback('change', path))
      .on('unlink', (path) => callback('unlink', path))
      .on('addDir', (path) => callback('addDir', path))
      .on('unlinkDir', (path) => callback('unlinkDir', path))
      .on('error', (error) => console.error('File watcher error:', error))

    console.log('👀 File watching started')
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      console.log('👁️ File watching stopped')
    }
    this.watchCallback = null
  }

  private shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.projectRoot, filePath)
    
    return this.ignorePatterns.some(pattern => {
      // Simple glob matching - convert * to regex
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
      
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(relativePath)
    })
  }

  isHealthy(): boolean {
    return this.isInitialized
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      projectRoot: this.projectRoot,
      isWatching: !!this.watcher,
      ignorePatterns: this.ignorePatterns
    }
  }
}