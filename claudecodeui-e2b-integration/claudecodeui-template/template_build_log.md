[2025-08-12T20:44:06Z] [config] [stdout]: Starting configuration script
[2025-08-12T20:44:06Z] [config] [stdout]: Enable swap
[2025-08-12T20:44:06Z] [config] [stdout]: Create default user 'user' (if doesn't exist yet)
[2025-08-12T20:44:06Z] [config] [stdout]: Adding user `user' ...
[2025-08-12T20:44:06Z] [config] [stdout]: Adding new group `user' (1000) ...
[2025-08-12T20:44:06Z] [config] [stdout]: Adding new user `user' (1000) with group `user (1000)' ...
[2025-08-12T20:44:06Z] [config] [stdout]: adduser: The home directory `/home/user' already exists.  Not touching this directory.
[2025-08-12T20:44:06Z] [config] [stdout]: adduser: Warning: The home directory `/home/user' does not belong to the user you are currently creating.
[2025-08-12T20:44:06Z] [config] [stdout]: Adding new user `user' to supplemental / extra groups `users' ...
[2025-08-12T20:44:06Z] [config] [stdout]: Adding user `user' to group `users' ...
[2025-08-12T20:44:06Z] [config] [stdout]: Copy skeleton files to /home/user
[2025-08-12T20:44:06Z] [config] [stdout]: Add sudo to 'user' with no password
[2025-08-12T20:44:06Z] [config] [stdout]: passwd: password changed.
[2025-08-12T20:44:06Z] [config] [stdout]: Give 'user' ownership to /home/user
[2025-08-12T20:44:07Z] [config] [stdout]: Give 777 permission to /usr/local
[2025-08-12T20:44:09Z] [config] [stdout]: Create /code directory
[2025-08-12T20:44:09Z] [config] [stdout]: Give 777 permission to /code
[2025-08-12T20:44:09Z] [config] [stdout]: Finished configuration script
[2025-08-12T20:44:09Z] Running start command
[2025-08-12T20:44:09Z] Waiting for template to be ready
[2025-08-12T20:44:09Z] [ready cmd]: /home/user/scripts/basic-ready.sh
[2025-08-12T20:44:09Z] [ready] [stdout]: 🔍 Basic PRIA Ready Check
[2025-08-12T20:44:09Z] [ready] [stdout]: ========================
[2025-08-12T20:44:09Z] [ready] [stdout]: Attempt 1/20...
[2025-08-12T20:44:09Z] [start] [stdout]: 🚀 Starting PRIA Development Environment
[2025-08-12T20:44:09Z] [start] [stdout]: ⚠️  Running as root, switching to user context
[2025-08-12T20:44:09Z] [start] [stdout]: 🚀 Starting PRIA Development Environment
[2025-08-12T20:44:09Z] [start] [stdout]: 🔧 Running post-user setup...
[2025-08-12T20:44:09Z] [start] [stdout]: 🔧 Running post-user setup...
[2025-08-12T20:44:09Z] [start] [stdout]: Testing Claude CLI...
[2025-08-12T20:44:09Z] [ready] [stdout]: ❌ Server (3008): Not ready
[2025-08-12T20:44:09Z] [ready] [stdout]: ❌ Client (3009): Not ready
[2025-08-12T20:44:09Z] [ready] [stdout]: ⏳ Waiting 15s...
[2025-08-12T20:44:11Z] [start] [stdout]: ✅ System-wide Claude CLI is available
[2025-08-12T20:44:11Z] [start] [stdout]: ✅ Post-user setup completed
[2025-08-12T20:44:11Z] [start] [stdout]: ⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)
[2025-08-12T20:44:11Z] [start] [stdout]: 🔍 Checking Claude projects...
[2025-08-12T20:44:11Z] [start] [stdout]: 📂 No Claude projects found, creating default project...
[2025-08-12T20:44:11Z] [start] [stdout]: 🔍 Debugging Claude CLI setup...
[2025-08-12T20:44:11Z] [start] [stdout]: Current user: user
[2025-08-12T20:44:11Z] [start] [stdout]: User ID: 1000
[2025-08-12T20:44:11Z] [start] [stdout]: Home directory: /home/user
[2025-08-12T20:44:11Z] [start] [stdout]: Updated PATH: /usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[2025-08-12T20:44:11Z] [start] [stdout]: Claude CLI location: /usr/local/lib/npm-global/bin/claude
[2025-08-12T20:44:13Z] [start] [stdout]: System-wide check: 1.0.77 (Claude Code)
[2025-08-12T20:44:13Z] [start] [stdout]: User path check: /home/user/start-all-services.sh: line 50: /home/user/.npm-global/bin/claude: No such file or directory
[2025-08-12T20:44:13Z] [start] [stdout]: User path failed
[2025-08-12T20:44:14Z] [start] [stdout]: Direct path check: 1.0.77 (Claude Code)
[2025-08-12T20:44:14Z] [start] [stdout]: Config file exists: /home/user/.config/claude/config.json
[2025-08-12T20:44:14Z] [start] [stdout]: Config contents: {"anthropicApiKey": "sk-ant-api03-8OoeW4HdwIcnVDX1dzgaNKmvmDak2AQ8IFurZGc6qlDF8FjYOxwCkUcgco4beZfPGO...
[2025-08-12T20:44:14Z] [start] [stdout]: ENV API key status: SET (108 chars)
[2025-08-12T20:44:14Z] [start] [stdout]: 🧪 Testing Claude CLI...
[2025-08-12T20:44:14Z] [start] [stdout]: Using claude-wrapper...
[2025-08-12T20:44:15Z] [start] [stdout]: 1.0.77 (Claude Code)
[2025-08-12T20:44:15Z] [start] [stdout]: Using direct path...
[2025-08-12T20:44:15Z] [start] [stdout]: /home/user/start-all-services.sh: line 71: /home/user/.npm-global/bin/claude: No such file or directory
[2025-08-12T20:44:15Z] [start] [stdout]: Direct CLI version check failed
[2025-08-12T20:44:15Z] [start] [stdout]: 🔑 Testing Claude CLI authentication...
[2025-08-12T20:44:15Z] [start] [stdout]: Using Claude CLI command: /home/user/claude-wrapper
[2025-08-12T20:44:19Z] [start] [stdout]: I see you've entered "test". What would you like me to help you test or work on?
[2025-08-12T20:44:19Z] [start] [stdout]: 📂 Creating Claude project with full logging...
[2025-08-12T20:44:21Z] Saved: svl1jvwih86s398v52qk/21ed1756-ba5b-47d4-9d73-48630f06d81d
[2025-08-12T20:44:25Z] [ready] [stdout]: Attempt 2/20...
[2025-08-12T20:44:25Z] [ready] [stdout]: ❌ Server (3008): Not ready
[2025-08-12T20:44:25Z] [ready] [stdout]: ❌ Client (3009): Not ready
[2025-08-12T20:44:25Z] [ready] [stdout]: ⏳ Waiting 15s...
[2025-08-12T20:44:25Z] [start] [stdout]: Welcome to your Next.js project! I'm Claude Code and I'm here to help you with development tasks.     
[2025-08-12T20:44:25Z] [start] [stdout]: I can assist you with:
[2025-08-12T20:44:25Z] [start] [stdout]: - Code implementation and debugging
[2025-08-12T20:44:25Z] [start] [stdout]: - Adding new features
[2025-08-12T20:44:25Z] [start] [stdout]: - Refactoring existing code
[2025-08-12T20:44:25Z] [start] [stdout]: - Running tests and builds
[2025-08-12T20:44:25Z] [start] [stdout]: - Project setup and configuration
[2025-08-12T20:44:25Z] [start] [stdout]: - Code analysis and explanations
[2025-08-12T20:44:25Z] [start] [stdout]: What would you like to work on today?
[2025-08-12T20:44:25Z] [start] [stdout]: Claude CLI exit code: 0
[2025-08-12T20:44:25Z] [start] [stdout]: 🔍 Checking created projects...
[2025-08-12T20:44:25Z] [start] [stdout]: /home/user/.claude/projects/-home-user-baseline-project/66d653af-f84f-482b-aed2-727e6e0331e7.jsonl    
[2025-08-12T20:44:25Z] [start] [stdout]: /home/user/.claude/projects/-home-user-baseline-project/a1e861bb-42f7-482a-92ef-aefbc4d09b8b.jsonl    
[2025-08-12T20:44:25Z] [start] [stdout]: ✅ Default Claude project created successfully
[2025-08-12T20:44:25Z] [start] [stdout]: 🚀 Starting claudecodeui services (production mode)...
[2025-08-12T20:44:25Z] [start] [stdout]: ✅ API Server started with PID: 574
[2025-08-12T20:44:27Z] [start] [stdout]: ✅ Frontend started with PID: 604
[2025-08-12T20:44:31Z] [start] [stdout]: 📋 claudecodeui Frontend: http://localhost:3009
[2025-08-12T20:44:31Z] [start] [stdout]: 🔧 API Server: http://localhost:3008
[2025-08-12T20:44:31Z] [start] [stdout]: 📁 Projects: /home/user/projects
[2025-08-12T20:44:31Z] [start] [stdout]: 🧠 Claude Sessions: /home/user/.claude
[2025-08-12T20:44:36Z] ...
[2025-08-12T20:44:40Z] [ready] [stdout]: Attempt 3/20...
[2025-08-12T20:44:40Z] [ready] [stdout]: ✅ Server (3008): Responding
[2025-08-12T20:44:40Z] [ready] [stdout]: ✅ Client (3009): Responding
[2025-08-12T20:44:40Z] [ready] [stdout]: 🎉 PRIA Environment is READY!
[2025-08-12T20:44:40Z] [ready] [stdout]: 📋 claudecodeui: http://localhost:3009
[2025-08-12T20:44:40Z] [ready] [stdout]: 🔧 API Server: http://localhost:3008
[2025-08-12T20:44:40Z] Template is ready
[2025-08-12T20:44:40Z] Saving layer: 9e61dubo40hx58pnzfoc/355ffd61-e3d5-443b-bb77-107e22c88812
[2025-08-12T20:44:45Z] ...
[2025-08-12T20:44:46Z] Saved: 9e61dubo40hx58pnzfoc/355ffd61-e3d5-443b-bb77-107e22c88812
[2025-08-12T20:44:47Z] Build finished, took 2m36s
