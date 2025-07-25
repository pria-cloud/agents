'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, ExternalLink } from 'lucide-react'

interface LivePreviewProps {
  sandboxUrl: string
  status: string
}

export function LivePreview({ sandboxUrl, status }: LivePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Live Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sandboxUrl ? (
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded border flex items-center justify-center">
              <iframe 
                src={sandboxUrl} 
                className="w-full h-full rounded"
                title="Live Preview"
              />
            </div>
            <Button 
              onClick={() => window.open(sandboxUrl, '_blank')} 
              className="w-full"
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded border flex items-center justify-center">
            <div className="text-center">
              <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Preview will appear when ready
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}