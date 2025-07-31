# 🔒 SECURITY SETUP GUIDE

## 🚨 IMPORTANT: Credential Security

**CRITICAL**: The original `.env.local` file contained exposed production credentials. These have been replaced with template values, but you must:

### Immediate Actions Required:

1. **Revoke Exposed Credentials** (if you pulled this code from a public repository):
   - Regenerate all Supabase API keys at https://supabase.com/dashboard
   - Regenerate Anthropic API key at https://console.anthropic.com/
   - Regenerate E2B API key at https://e2b.dev/
   - Update any deployed applications with new credentials

2. **Secure Environment Setup**:
   ```bash
   # Copy the template
   cp .env.example .env.local
   
   # Edit with your actual credentials (NEVER commit this file)
   nano .env.local
   ```

3. **Verify .gitignore Protection**:
   - Ensure `.env.local` is in `.gitignore` (already added)
   - Never commit files containing real credentials

## 🔑 Required Credentials

### Supabase Configuration
1. Go to https://supabase.com/dashboard
2. Create a new project or select existing
3. Go to Settings → API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon/Public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

### Claude API
1. Go to https://console.anthropic.com/
2. Create API key
3. Copy to `ANTHROPIC_API_KEY`

### E2B Sandbox
1. Go to https://e2b.dev/
2. Sign up and get API key
3. Copy to `E2B_API_KEY`

## 🛡️ Security Best Practices

- **Never commit credential files** to version control
- **Use environment variables** in production deployments
- **Rotate credentials regularly**
- **Use least-privilege access** for all services
- **Monitor API usage** for unauthorized access
- **Use HTTPS only** in production

## 🔍 Database Security

The application uses Row-Level Security (RLS) for multi-tenant isolation:
- All database operations are workspace-scoped
- Users can only access their workspace data
- Service role is used only for admin operations

## 🔐 Internal API Security

The application uses a secure internal authentication system for service-to-service calls:
- JWT-style tokens with HMAC-SHA256 signatures
- Time-limited tokens (5 minutes expiry)
- Replay protection with nonces
- Separate rate limiting for internal calls
- No service role keys exposed in headers

### Internal Authentication Features:
- **Token-based authentication**: Secure HMAC-signed tokens
- **Time-based expiry**: Automatic token expiration
- **Rate limiting**: Separate limits for internal vs user calls
- **Purpose tracking**: Tokens include purpose for audit trails
- **Replay protection**: Unique nonces prevent token reuse

## 📱 Deployment Security

### Environment Variables in Production:
- Use your platform's secret management (Vercel secrets, etc.)
- Never expose secrets in build logs
- Set `NODE_ENV=production` for production builds

### Recommended Production Setup:
```bash
# Vercel deployment
vercel env add ANTHROPIC_API_KEY
vercel env add E2B_API_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

## 🚨 Security Incident Response

If credentials are compromised:
1. **Immediately revoke** all affected API keys
2. **Generate new credentials** for all services
3. **Update all deployments** with new credentials
4. **Monitor logs** for unauthorized access
5. **Report incident** if required by your organization

## 📞 Support

For security concerns:
- Review Supabase security docs: https://supabase.com/docs/guides/platform/going-into-prod
- Review Anthropic security: https://docs.anthropic.com/claude/docs/api-security
- Review E2B security: https://e2b.dev/docs/security