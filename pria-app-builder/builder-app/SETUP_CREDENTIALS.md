# 🔧 Quick Setup - Restore Your Credentials

## ⚠️ IMPORTANT: Security Notice

The `.env.local` file was reset to template values for security reasons. **Never commit real credentials to version control.**

## 🚀 Quick Fix - Restore Your Environment Variables

To test the app, you need to replace the template values in `.env.local` with your actual credentials:

### Required Services:

1. **Supabase** (Database & Auth)
   - Go to https://supabase.com/dashboard
   - Select your project → Settings → API
   - Copy the values for:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
     ```

2. **Anthropic Claude API** (AI Functionality)
   - Go to https://console.anthropic.com/
   - Create/get your API key:
     ```
     ANTHROPIC_API_KEY=your_actual_anthropic_key
     ```

3. **E2B Sandbox** (Development Environment)
   - Go to https://e2b.dev/
   - Get your API key:
     ```
     E2B_API_KEY=your_actual_e2b_key
     ```

### Quick Setup Commands:

```bash
# 1. Copy your actual values to .env.local
cp .env.example .env.local

# 2. Edit .env.local with your real credentials
nano .env.local
# or use your preferred editor

# 3. Start the development server
npm run dev
```

### Testing the App:

Once you've restored your credentials:

1. **Start the app**: `npm run dev`
2. **Visit**: http://localhost:3000
3. **Test authentication** and workspace creation
4. **Verify** Claude Code integration works

## 🛡️ Security Best Practices:

- **NEVER** commit `.env.local` to git
- **Rotate credentials** regularly  
- **Use different credentials** for development vs production
- **Monitor API usage** for unauthorized access

## 📞 Need Help?

If you don't have credentials for any service:

1. **Supabase**: Create free account at https://supabase.com
2. **Claude API**: Request access at https://console.anthropic.com
3. **E2B**: Sign up at https://e2b.dev

The app requires all three services to function properly.