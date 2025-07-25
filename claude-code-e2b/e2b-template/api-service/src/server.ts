import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server } from 'ws'
import { createServer } from 'http'
import dotenv from 'dotenv'

import { ClaudeService } from './claude-service'
import { GitService } from './git-service'
import { ProjectService } from './project-service'
import { FileService } from './file-service'
import { WebSocketService } from './websocket-service'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const wss = new Server({ server })

// Initialize services
const claudeService = new ClaudeService()
const gitService = new GitService()
const projectService = new ProjectService()
const fileService = new FileService()
const wsService = new WebSocketService(wss)

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow WebSocket connections
  crossOriginEmbedderPolicy: false
}))
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}))
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      claude: claudeService.isHealthy(),
      git: gitService.isHealthy(),
      project: projectService.isHealthy(),
      files: fileService.isHealthy()
    }
  })
})

// Claude Code API routes
app.post('/api/claude/chat', async (req, res) => {
  try {
    const { message, conversationId, systemPrompt, maxTurns, projectContext } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const result = await claudeService.chat({
      message,
      conversationId,
      systemPrompt,
      maxTurns: maxTurns || 5,
      projectContext
    })

    // Broadcast to WebSocket clients
    wsService.broadcast('claude_response', result)

    return res.json(result)
  } catch (error) {
    console.error('Claude chat error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.get('/api/claude/conversation/:id', async (req, res) => {
  try {
    const conversation = await claudeService.getConversation(req.params.id)
    return res.json(conversation)
  } catch (error) {
    console.error('Get conversation error:', error)
    return res.status(500).json({ error: 'Failed to retrieve conversation' })
  }
})

app.delete('/api/claude/conversation/:id', async (req, res) => {
  try {
    await claudeService.clearConversation(req.params.id)
    return res.json({ success: true })
  } catch (error) {
    console.error('Clear conversation error:', error)
    return res.status(500).json({ error: 'Failed to clear conversation' })
  }
})

// Project management routes
app.post('/api/project/create', async (req, res) => {
  try {
    const { name, template, gitRepo, description } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' })
    }

    const project = await projectService.createProject({
      name,
      template: template || 'nextjs',
      gitRepo,
      description
    })

    wsService.broadcast('project_created', project)
    return res.json(project)
  } catch (error) {
    console.error('Create project error:', error)
    return res.status(500).json({ error: 'Failed to create project' })
  }
})

app.post('/api/project/clone', async (req, res) => {
  try {
    const { gitUrl, branch, credentials } = req.body
    
    if (!gitUrl) {
      return res.status(400).json({ error: 'Git URL is required' })
    }

    const project = await projectService.cloneProject({
      gitUrl,
      branch: branch || 'main',
      credentials
    })

    wsService.broadcast('project_cloned', project)
    return res.json(project)
  } catch (error) {
    console.error('Clone project error:', error)
    return res.status(500).json({ error: 'Failed to clone project' })
  }
})

app.get('/api/project/status', async (req, res) => {
  try {
    const status = await projectService.getProjectStatus()
    return res.json(status)
  } catch (error) {
    console.error('Get project status error:', error)
    return res.status(500).json({ error: 'Failed to get project status' })
  }
})

app.post('/api/project/build', async (req, res) => {
  try {
    const result = await projectService.buildProject()
    wsService.broadcast('project_built', result)
    return res.json(result)
  } catch (error) {
    console.error('Build project error:', error)
    return res.status(500).json({ error: 'Failed to build project' })
  }
})

app.post('/api/project/preview', async (req, res) => {
  try {
    const result = await projectService.startPreview()
    wsService.broadcast('preview_started', result)
    return res.json(result)
  } catch (error) {
    console.error('Start preview error:', error)
    return res.status(500).json({ error: 'Failed to start preview' })
  }
})

// Git operation routes
app.post('/api/git/commit', async (req, res) => {
  try {
    const { message, files, author } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'Commit message is required' })
    }

    const result = await gitService.commit({ message, files, author })
    wsService.broadcast('git_committed', result)
    return res.json(result)
  } catch (error) {
    console.error('Git commit error:', error)
    return res.status(500).json({ error: 'Failed to commit changes' })
  }
})

app.post('/api/git/push', async (req, res) => {
  try {
    const result = await gitService.push()
    wsService.broadcast('git_pushed', result)
    return res.json(result)
  } catch (error) {
    console.error('Git push error:', error)
    return res.status(500).json({ error: 'Failed to push changes' })
  }
})

app.get('/api/git/status', async (req, res) => {
  try {
    const status = await gitService.getStatus()
    return res.json(status)
  } catch (error) {
    console.error('Git status error:', error)
    return res.status(500).json({ error: 'Failed to get git status' })
  }
})

app.post('/api/git/branch', async (req, res) => {
  try {
    const { name, action, from } = req.body
    
    if (!name || !action) {
      return res.status(400).json({ error: 'Branch name and action are required' })
    }

    const result = await gitService.manageBranch({ name, action, from })
    wsService.broadcast('git_branch_changed', result)
    return res.json(result)
  } catch (error) {
    console.error('Git branch error:', error)
    return res.status(500).json({ error: 'Failed to manage branch' })
  }
})

// File operation routes
app.get('/api/files/tree', async (req, res) => {
  try {
    const tree = await fileService.getFileTree()
    return res.json(tree)
  } catch (error) {
    console.error('Get file tree error:', error)
    return res.status(500).json({ error: 'Failed to get file tree' })
  }
})

app.get('/api/files/content/*', async (req, res) => {
  try {
    const filePath = req.url.replace('/api/files/content/', '')
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' })
    }

    const content = await fileService.getFileContent(decodeURIComponent(filePath))
    return res.json({ path: filePath, content })
  } catch (error) {
    console.error('Get file content error:', error)
    return res.status(500).json({ error: 'Failed to get file content' })
  }
})

app.post('/api/files/save', async (req, res) => {
  try {
    const { path, content, createDirectories } = req.body
    
    if (!path || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required' })
    }

    const result = await fileService.saveFile(path, content, createDirectories)
    wsService.broadcast('file_saved', { path, size: content.length })
    return res.json(result)
  } catch (error) {
    console.error('Save file error:', error)
    return res.status(500).json({ error: 'Failed to save file' })
  }
})

app.delete('/api/files/*', async (req, res) => {
  try {
    const filePath = req.url.replace('/api/files/', '')
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' })
    }

    const result = await fileService.deleteFile(decodeURIComponent(filePath))
    wsService.broadcast('file_deleted', { path: filePath })
    return res.json(result)
  } catch (error) {
    console.error('Delete file error:', error)
    return res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Start server
const PORT = process.env.API_PORT || 8080
server.listen(PORT, () => {
  console.log(`🚀 Claude Code E2B API service running on port ${PORT}`)
  console.log(`📁 Working directory: ${process.cwd()}`)
  console.log(`🌐 Health check: http://localhost:${PORT}/health`)
  
  // Initialize file watcher for real-time updates after a short delay
  setTimeout(() => {
    fileService.startWatching((event, path) => {
      wsService.broadcast('file_changed', { event, path })
    })
  }, 1000)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

export default app