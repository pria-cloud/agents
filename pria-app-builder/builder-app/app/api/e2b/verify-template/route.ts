import { NextResponse } from 'next/server'
import { verifyCustomTemplate, getTemplateInfo } from '@/lib/e2b/verify-template'

export async function GET() {
  try {
    const templateInfo = getTemplateInfo()
    
    // Basic info without creating a sandbox
    return NextResponse.json({
      ...templateInfo,
      message: 'Template configuration loaded successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get template info', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    // Actually test the template by creating a sandbox
    const result = await verifyCustomTemplate()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Custom template verified successfully',
        templateId: result.templateId
      })
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Template verification failed',
          details: result.error 
        },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Template verification error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}