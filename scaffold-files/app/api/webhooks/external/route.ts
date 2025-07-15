import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Log the received webhook data
    console.log('📥 Received webhook:', {
      timestamp: new Date().toISOString(),
      payload: payload
    });

    // Process the webhook data here
    // You can add your custom logic to handle different types of events
    
    const response = {
      received: true,
      timestamp: new Date().toISOString(),
      event: payload.event || 'unknown',
      processed: true,
      workspaceId: process.env.DAYTONA_WORKSPACE_ID || 'local',
      message: 'Webhook processed successfully'
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        timestamp: new Date().toISOString(),
        received: false
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 