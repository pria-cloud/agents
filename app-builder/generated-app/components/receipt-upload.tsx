'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { uploadReceipt } from '@/actions/expenses';

interface ReceiptUploadProps {
  onUploadSuccess: (url: string) => void;
  onUploadError: (message: string) => void;
}

export function ReceiptUpload({ onUploadSuccess, onUploadError }: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      onUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    // Simulate progress for UI (actual Supabase upload doesn't provide progress directly via server action)
    const uploadInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadReceipt(formData);
      clearInterval(uploadInterval);

      if (result.success && result.url) {
        setUploadProgress(100);
        onUploadSuccess(result.url);
      } else {
        setUploadProgress(0);
        onUploadError(result.message || 'Upload failed.');
      }
    } catch (error) {
      clearInterval(uploadInterval);
      setUploadProgress(0);
      onUploadError('An unexpected error occurred during upload.');
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="receipt">Receipt (Optional)</Label>
      <Input id="receipt" type="file" onChange={handleFileChange} disabled={uploading} accept="image/*,application/pdf" />
      {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
      <Button onClick={handleUpload} disabled={uploading || !file}>
        {uploading ? 'Uploading...' : 'Upload Receipt'}
      </Button>
      {uploading && <Progress value={uploadProgress} className="w-full mt-2" />}
    </div>
  );
}
