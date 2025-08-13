[2025-08-13T08:52:59Z] [config] [stdout]: Starting configuration script
[2025-08-13T08:52:59Z] [config] [stdout]: Enable swap
[2025-08-13T08:52:59Z] [config] [stdout]: Create default user 'user' (if doesn't exist yet)
[2025-08-13T08:53:00Z] [config] [stdout]: Adding user `user' ...
[2025-08-13T08:53:00Z] [config] [stdout]: Adding new group `user' (1000) ...
[2025-08-13T08:53:00Z] [config] [stdout]: Adding new user `user' (1000) with group `user (1000)' ...
[2025-08-13T08:53:00Z] [config] [stdout]: adduser: The home directory `/home/user' already exists.  Not touching this directory.
[2025-08-13T08:53:00Z] [config] [stdout]: adduser: Warning: The home directory `/home/user' does not belong to the user you are currently creating.
[2025-08-13T08:53:00Z] [config] [stdout]: Adding new user `user' to supplemental / extra groups `users' ...
[2025-08-13T08:53:00Z] [config] [stdout]: Adding user `user' to group `users' ...
[2025-08-13T08:53:00Z] [config] [stdout]: Copy skeleton files to /home/user
[2025-08-13T08:53:00Z] [config] [stdout]: Add sudo to 'user' with no password
[2025-08-13T08:53:00Z] [config] [stdout]: passwd: password changed.
[2025-08-13T08:53:00Z] [config] [stdout]: Give 'user' ownership to /home/user
[2025-08-13T08:53:00Z] [config] [stdout]: Give 777 permission to /usr/local
[2025-08-13T08:53:02Z] [config] [stdout]: Create /code directory
[2025-08-13T08:53:02Z] [config] [stdout]: Give 777 permission to /code
[2025-08-13T08:53:02Z] [config] [stdout]: Finished configuration script
[2025-08-13T08:53:02Z] Running start command
[2025-08-13T08:53:02Z] Waiting for template to be ready
[2025-08-13T08:53:02Z] [ready cmd]: /home/user/scripts/basic-ready.sh
[2025-08-13T08:53:02Z] [start] [stdout]: 🚀 Starting PRIA Development Environment
[2025-08-13T08:53:02Z] [ready] [stdout]: 🔍 Basic PRIA Ready Check
[2025-08-13T08:53:02Z] [ready] [stdout]: ========================
[2025-08-13T08:53:02Z] [ready] [stdout]: Attempt 1/20...
[2025-08-13T08:53:02Z] [start] [stdout]: ⚠️  Running as root, switching to user context
[2025-08-13T08:53:03Z] [start] [stdout]: 🚀 Starting PRIA Development Environment
[2025-08-13T08:53:03Z] [start] [stdout]: 🔧 Running post-user setup...
[2025-08-13T08:53:03Z] [ready] [stdout]: ❌ Server (3008): Not ready
[2025-08-13T08:53:03Z] [start] [stdout]: 🔧 Running post-user setup...
[2025-08-13T08:53:03Z] [ready] [stdout]: ❌ Client (3009): Not ready
[2025-08-13T08:53:03Z] [ready] [stdout]: ⏳ Waiting 15s...
[2025-08-13T08:53:03Z] [start] [stdout]: ✅ Claude config created with API key (217 chars)
[2025-08-13T08:53:03Z] [start] [stdout]: ✅ Added ANTHROPIC_API_KEY to .bashrc
[2025-08-13T08:53:03Z] [start] [stdout]: Testing Claude CLI...
[2025-08-13T08:53:04Z] [start] [stdout]: ✅ System-wide Claude CLI is available
[2025-08-13T08:53:04Z] [start] [stdout]: ✅ Post-user setup completed
[2025-08-13T08:53:04Z] [start] [stdout]: ✅ Loading environment variables from .env
[2025-08-13T08:53:04Z] [start] [stdout]: ✅ ANTHROPIC_API_KEY loaded (108 chars)
[2025-08-13T08:53:04Z] [start] [stdout]: ⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)
[2025-08-13T08:53:04Z] [start] [stdout]: 🔍 Verifying Claude CLI installation...
[2025-08-13T08:53:05Z] [start] [stdout]: ✅ Claude CLI is available: 1.0.77 (Claude Code)
[2025-08-13T08:53:05Z] [start] [stdout]: ✅ Claude config file exists
[2025-08-13T08:53:05Z] [start] [stdout]: ✅ ANTHROPIC_API_KEY is set
[2025-08-13T08:53:05Z] [start] [stdout]: ℹ️  Claude project initialization deferred to runtime (via Instance API)
[2025-08-13T08:53:05Z] [start] [stdout]: 🚀 Starting claudecodeui services (production mode)...
[2025-08-13T08:53:05Z] [start] [stdout]: ✅ API Server started with PID: 440
[2025-08-13T08:53:07Z] [start] [stdout]: ✅ Frontend started with PID: 470
[2025-08-13T08:53:11Z] [start] [stdout]: 📋 claudecodeui Frontend: http://localhost:3009
[2025-08-13T08:53:11Z] [start] [stdout]: 🔧 API Server: http://localhost:3008
[2025-08-13T08:53:11Z] [start] [stdout]: 📁 Projects: /home/user/projects
[2025-08-13T08:53:11Z] [start] [stdout]: 🧠 Claude Sessions: /home/user/.claude
[2025-08-13T08:53:16Z] ...
[2025-08-13T08:53:18Z] [ready] [stdout]: Attempt 2/20...
[2025-08-13T08:53:18Z] [ready] [stdout]: ✅ Server (3008): Responding
[2025-08-13T08:53:18Z] [ready] [stdout]: ✅ Client (3009): Responding
[2025-08-13T08:53:18Z] [ready] [stdout]: 🎉 PRIA Environment is READY!
[2025-08-13T08:53:18Z] [ready] [stdout]: 📋 claudecodeui: http://localhost:3009
[2025-08-13T08:53:18Z] [ready] [stdout]: 🔧 API Server: http://localhost:3008
[2025-08-13T08:53:18Z] Template is ready
[2025-08-13T08:53:18Z] Saving layer: 9e61dubo40hx58pnzfoc/9714d905-7015-4e6b-ab1f-4d27d0fe312d
[2025-08-13T08:53:18Z] Saved: qateldjnb7fcqfz8lp92/bab15d3c-f201-4bb7-88b1-b193a9b1eedb
[2025-08-13T08:53:23Z] ...
[2025-08-13T08:53:24Z] Saved: 9e61dubo40hx58pnzfoc/9714d905-7015-4e6b-ab1f-4d27d0fe312d
[2025-08-13T08:53:25Z] Build finished, took 2m15s