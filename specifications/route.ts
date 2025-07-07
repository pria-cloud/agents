import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { userInput, conversationId }: { userInput: string; conversationId?: string } = await req.json()

    const a2aRouterUrl = process.env.A2A_ROUTER_URL
    const a2aRouterApiKey = process.env.A2A_ROUTER_API_KEY

    if (!a2aRouterUrl) {
      console.error("A2A_ROUTER_URL environment variable is not set.")
      return new NextResponse("A2A Router URL is not configured.", { status: 500 })
    }

    const requestBody: { intent: string; userInput: string; conversationId?: string } = {
      intent: "app.compose",
      userInput: userInput,
    }

    if (conversationId) {
      requestBody.conversationId = conversationId
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    if (a2aRouterApiKey) {
      headers["x-api-key"] = a2aRouterApiKey
    }

    console.log(`Forwarding request to A2A Router: ${a2aRouterUrl}/a2a/intent`)
    console.log("Request Body:", JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${a2aRouterUrl}/a2a/intent`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Error response from A2A Router (HTTP Status ${response.status}):`, errorText)
      return new NextResponse(`Error from A2A Router: ${errorText}`, { status: response.status })
    }

    const contentType = response.headers.get("Content-Type")
    if (!contentType || !contentType.includes("application/json")) {
      const rawResponse = await response.text()
      console.error("A2A Router returned non-JSON response. Content-Type:", contentType, "Body:", rawResponse)
      return new NextResponse("A2A Router returned an unexpected response format. Expected JSON.", { status: 500 })
    }

    const routerResponse = await response.json()
    console.log("Response from A2A Router:", JSON.stringify(routerResponse, null, 2))

    return new NextResponse(JSON.stringify(routerResponse), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error in application-builder-chat API route:", error)
    // Check if the error is a TypeError (e.g., network error, fetch failed)
    if (error instanceof TypeError) {
      return new NextResponse(`Network or A2A Router connection error: ${error.message}`, { status: 500 })
    }
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
