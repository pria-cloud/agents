[2025-08-12T22:23:16Z] [config] [stdout]: Starting configuration script
[2025-08-12T22:23:16Z] [config] [stdout]: Enable swap
[2025-08-12T22:23:16Z] [config] [stdout]: Create default user 'user' (if doesn't exist yet)
[2025-08-12T22:23:17Z] [config] [stdout]: Adding user `user' ...
[2025-08-12T22:23:17Z] [config] [stdout]: Adding new group `user' (1000) ...
[2025-08-12T22:23:17Z] [config] [stdout]: Adding new user `user' (1000) with group `user (1000)' ...
[2025-08-12T22:23:17Z] [config] [stdout]: adduser: The home directory `/home/user' already exists.  Not touching this directory.
[2025-08-12T22:23:17Z] [config] [stdout]: adduser: Warning: The home directory `/home/user' does not belong to the user you are currently creating.
[2025-08-12T22:23:17Z] [config] [stdout]: Adding new user `user' to supplemental / extra groups `users' ...
[2025-08-12T22:23:17Z] [config] [stdout]: Adding user `user' to group `users' ...
[2025-08-12T22:23:17Z] [config] [stdout]: Copy skeleton files to /home/user
[2025-08-12T22:23:17Z] [config] [stdout]: Add sudo to 'user' with no password
[2025-08-12T22:23:17Z] [config] [stdout]: passwd: password changed.
[2025-08-12T22:23:17Z] [config] [stdout]: Give 'user' ownership to /home/user
[2025-08-12T22:23:18Z] [config] [stdout]: Give 777 permission to /usr/local
[2025-08-12T22:23:19Z] [config] [stdout]: Create /code directory
[2025-08-12T22:23:19Z] [config] [stdout]: Give 777 permission to /code
[2025-08-12T22:23:19Z] [config] [stdout]: Finished configuration script
[2025-08-12T22:23:19Z] Running start command
[2025-08-12T22:23:19Z] Waiting for template to be ready
[2025-08-12T22:23:19Z] [ready cmd]: /home/user/scripts/basic-ready.sh
[2025-08-12T22:23:19Z] [start] [stdout]: 🚀 Starting PRIA Development Environment
[2025-08-12T22:23:19Z] [ready] [stdout]: 🔍 Basic PRIA Ready Check
[2025-08-12T22:23:19Z] [ready] [stdout]: ========================
[2025-08-12T22:23:19Z] [ready] [stdout]: Attempt 1/20...
[2025-08-12T22:23:19Z] [start] [stdout]: ⚠️  Running as root, switching to user context
[2025-08-12T22:23:19Z] [start] [stdout]: 🚀 Starting PRIA Development Environment
[2025-08-12T22:23:19Z] [start] [stdout]: 🔧 Running post-user setup...
[2025-08-12T22:23:20Z] [start] [stdout]: 🔧 Running post-user setup...
[2025-08-12T22:23:20Z] [ready] [stdout]: ❌ Server (3008): Not ready
[2025-08-12T22:23:20Z] [ready] [stdout]: ❌ Client (3009): Not ready
[2025-08-12T22:23:20Z] [ready] [stdout]: ⏳ Waiting 15s...
[2025-08-12T22:23:20Z] [start] [stdout]: ✅ Claude config created with API key (108 chars)
[2025-08-12T22:23:20Z] [start] [stdout]: ✅ Added ANTHROPIC_API_KEY to .bashrc
[2025-08-12T22:23:20Z] [start] [stdout]: Testing Claude CLI...
[2025-08-12T22:23:21Z] [start] [stdout]: ✅ System-wide Claude CLI is available
[2025-08-12T22:23:21Z] [start] [stdout]: ✅ Post-user setup completed
[2025-08-12T22:23:21Z] [start] [stdout]: ⚠️  ANTHROPIC_API_KEY not set
[2025-08-12T22:23:21Z] [start] [stdout]: ⚠️  GITHUB_TOKEN not set (GitHub integration will be limited)
[2025-08-12T22:23:21Z] [start] [stdout]: 🔍 Verifying Claude CLI installation...
[2025-08-12T22:23:23Z] [start] [stdout]: ✅ Claude CLI is available: 1.0.77 (Claude Code)
[2025-08-12T22:23:23Z] [start] [stdout]: ✅ Claude config file exists
[2025-08-12T22:23:23Z] [start] [stdout]: ⚠️  ANTHROPIC_API_KEY not set - Claude CLI may not work
[2025-08-12T22:23:23Z] [start] [stdout]: ℹ️  Claude project initialization deferred to runtime (via Instance API)
[2025-08-12T22:23:23Z] [start] [stdout]: 🚀 Starting claudecodeui services (production mode)...
[2025-08-12T22:23:23Z] [start] [stdout]: ✅ API Server started with PID: 466
[2025-08-12T22:23:25Z] [start] [stdout]: ✅ Frontend started with PID: 496
[2025-08-12T22:23:29Z] [start] [stdout]: 📋 claudecodeui Frontend: http://localhost:3009
[2025-08-12T22:23:29Z] [start] [stdout]: 🔧 API Server: http://localhost:3008
[2025-08-12T22:23:29Z] [start] [stdout]: 📁 Projects: /home/user/projects
[2025-08-12T22:23:29Z] [start] [stdout]: 🧠 Claude Sessions: /home/user/.claude
[2025-08-12T22:23:33Z] Saved: nzzsijwpuoxwrqj0hiu5/526889d3-1457-42fc-94d7-590ed07105bf
[2025-08-12T22:23:35Z] [ready] [stdout]: Attempt 2/20...
[2025-08-12T22:23:35Z] [ready] [stdout]: ✅ Server (3008): Responding
[2025-08-12T22:23:35Z] [ready] [stdout]: ✅ Client (3009): Responding
[2025-08-12T22:23:35Z] [ready] [stdout]: 🎉 PRIA Environment is READY!
[2025-08-12T22:23:35Z] [ready] [stdout]: 📋 claudecodeui: http://localhost:3009
[2025-08-12T22:23:35Z] [ready] [stdout]: 🔧 API Server: http://localhost:3008
[2025-08-12T22:23:35Z] Template is ready
[2025-08-12T22:23:35Z] Saving layer: 9e61dubo40hx58pnzfoc/8124ba6e-9c93-444e-bc35-9ae89ef47114
[2025-08-12T22:23:40Z] ...
[2025-08-12T22:23:40Z] Saved: 9e61dubo40hx58pnzfoc/8124ba6e-9c93-444e-bc35-9ae89ef47114
[2025-08-12T22:23:41Z] Build finished, took 2m25s