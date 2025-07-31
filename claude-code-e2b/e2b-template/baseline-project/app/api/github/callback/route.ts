import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

export async function GET(request: NextRequest) {
  try {
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    // Handle OAuth errors
    if (error) {
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', error)
      return NextResponse.redirect(errorUrl)
    }
    
    if (!code || !state) {
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', 'missing_code_or_state')
      return NextResponse.redirect(errorUrl)
    }
    
    // Validate state parameter
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      
      // Check if state is not too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        throw new Error('State expired')
      }
    } catch (error) {
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', 'invalid_state')
      return NextResponse.redirect(errorUrl)
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    })
    
    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for token:', tokenResponse.statusText)
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', 'token_exchange_failed')
      return NextResponse.redirect(errorUrl)
    }
    
    const tokenData = await tokenResponse.json()
    
    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error_description)
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', tokenData.error)
      return NextResponse.redirect(errorUrl)
    }
    
    const accessToken = tokenData.access_token
    
    // Get user information from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    
    if (!userResponse.ok) {
      console.error('Failed to get user info from GitHub')
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', 'user_info_failed')
      return NextResponse.redirect(errorUrl)
    }
    
    const userData = await userResponse.json()
    
    // Store GitHub token and user info in the active session
    const { error: dbError } = await supabase
      .from('sessions')
      .update({
        github_token: accessToken,
        github_username: userData.login,
        github_user_id: userData.id.toString()
      })
      .eq('workspace_id', stateData.workspace_id)
      .eq('status', 'active')
    
    if (dbError) {
      console.error('Database error:', dbError)
      const errorUrl = new URL('/dashboard?github_auth=error', request.url)
      errorUrl.searchParams.set('error', 'database_error')
      return NextResponse.redirect(errorUrl)
    }
    
    // Redirect to success page
    const successUrl = new URL('/dashboard?github_auth=success', request.url)
    successUrl.searchParams.set('username', userData.login)
    return NextResponse.redirect(successUrl)
    
  } catch (error) {
    console.error('GitHub callback error:', error)
    const errorUrl = new URL('/dashboard?github_auth=error', request.url)
    errorUrl.searchParams.set('error', 'unexpected_error')
    return NextResponse.redirect(errorUrl)
  }
}