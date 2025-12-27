<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# how to support any major type of the file in upload including img

Here's a complete multifile-type upload handler supporting images, PDFs, text, audio, and video.

***

## Supported MIME types by Gemini API

[^1][^2][^3]

**Images:**

- `image/jpeg`, `image/png`, `image/webp` (max 15 MB or 24 megapixels per file)[^4]

**Documents:**

- `application/pdf` (up to 50 MB or 1000 pages)[^5]
- `text/plain`[^3]
- `text/markdown`[^3]

**Audio:**

- `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/flac` (max 40 MB or ~20 minutes)[^4]

**Video (beta):**

- `video/mp4`, `video/mpeg`, `video/mov`, `video/flv` (max 200 MB or 30 minutes)[^4]

***

## Updated Express endpoint supporting all file types

```ts
// index.ts
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();

// Configure Multer to accept all major file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max [web:50]
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      // Images [web:45]
      'image/jpeg',
      'image/png',
      'image/webp',
      // Documents [web:45]
      'application/pdf',
      'text/plain',
      'text/markdown',
      // Audio [web:45]
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/flac',
      // Video [web:50]
      'video/mp4',
      'video/mpeg',
      'video/mov',
      'video/quicktime',
      'video/x-flv',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

app.use(express.json());

// Universal upload endpoint for all file types [web:41]
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    // Determine file category for better handling [web:45][web:50]
    const fileCategory = getFileCategory(mimetype);

    // Process file based on type
    const result = await processFileWithGemini(
      buffer,
      mimetype,
      originalname,
      fileCategory
    );

    return res.json({
      success: true,
      fileName: originalname,
      fileType: fileCategory,
      mimeType: mimetype,
      fileSize: size,
      result: result,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({
      error: err.message || 'Failed to process file',
    });
  }
});

// Helper function to categorize file types [web:45][web:50]
function getFileCategory(
  mimetype: string
): 'image' | 'document' | 'audio' | 'video' | 'text' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'document';
  if (mimetype.startsWith('text/')) return 'text';
  return 'text';
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
```


***

## Gemini processing helper for all file types

```ts
// gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const apiKey = process.env.GEMINI_API_KEY!;
const client = new GoogleGenerativeAI(apiKey);

export async function processFileWithGemini(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  fileCategory: 'image' | 'document' | 'audio' | 'video' | 'text'
) {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // For PDF: save to temp file (Gemini SDK requires file path for PDFs) [web:27]
  if (mimeType === 'application/pdf') {
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, fileBuffer);

    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                // For PDFs, use file system path [web:27]
                inlineData: {
                  data: fileBuffer.toString('base64'),
                  mimeType: 'application/pdf',
                },
              },
              {
                text: `Analyze this ${fileCategory} file and provide:
1. A summary (2-3 sentences)
2. Key content or points
3. File purpose or type`,
              },
            ],
          },
        ],
      });

      fs.unlinkSync(tempPath); // Clean up temp file

      return {
        category: fileCategory,
        analysis: result.response.text(),
      };
    } catch (err) {
      fs.unlinkSync(tempPath);
      throw err;
    }
  }

  // For images [web:45]
  if (fileCategory === 'image') {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: mimeType,
              },
            },
            {
              text: `Analyze this image and provide:
1. What is shown in the image?
2. Key elements or objects
3. Any text present in the image`,
            },
          ],
        },
      ],
    });

    return {
      category: fileCategory,
      analysis: result.response.text(),
    };
  }

  // For audio files [web:45]
  if (fileCategory === 'audio') {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: mimeType,
              },
            },
            {
              text: `Transcribe and summarize this audio file:
1. Full transcription
2. Main topics discussed
3. Key takeaways`,
            },
          ],
        },
      ],
    });

    return {
      category: fileCategory,
      analysis: result.response.text(),
    };
  }

  // For video files [web:50]
  if (fileCategory === 'video') {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: mimeType,
              },
            },
            {
              text: `Analyze this video and provide:
1. What is the video about?
2. Key scenes or moments
3. Main message or content`,
            },
          ],
        },
      ],
    });

    return {
      category: fileCategory,
      analysis: result.response.text(),
    };
  }

  // For text files (TXT, Markdown) [web:45]
  if (fileCategory === 'text') {
    const textContent = fileBuffer.toString('utf-8');

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Here is a text file content:\n\n${textContent}\n\nProvide:
1. Summary (2-3 sentences)
2. Main topics
3. Key information`,
            },
          ],
        },
      ],
    });

    return {
      category: fileCategory,
      analysis: result.response.text(),
    };
  }

  throw new Error(`Unsupported file category: ${fileCategory}`);
}
```


***

## Example client request (multipart form)

```bash
# Upload an image
curl -X POST http://localhost:5000/upload \
  -F "file=@/path/to/image.jpg"

# Upload a PDF
curl -X POST http://localhost:5000/upload \
  -F "file=@/path/to/document.pdf"

# Upload audio
curl -X POST http://localhost:5000/upload \
  -F "file=@/path/to/audio.mp3"

# Upload video
curl -X POST http://localhost:5000/upload \
  -F "file=@/path/to/video.mp4"

# Upload text
curl -X POST http://localhost:5000/upload \
  -F "file=@/path/to/notes.txt"
```


***

## React form to upload any file type

```tsx
// UploadComponent.tsx
import React, { useState } from 'react';

export function UploadComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const supportedTypes = [
    // Images
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    // Documents
    '.pdf',
    '.txt',
    '.md',
    // Audio
    '.mp3',
    '.wav',
    '.flac',
    // Video
    '.mp4',
    '.mpeg',
    '.mov',
    '.flv',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[^0];
    if (selectedFile) {
      const fileExt = selectedFile.name.slice(
        selectedFile.name.lastIndexOf('.')
      );
      if (supportedTypes.includes(fileExt.toLowerCase())) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError(`Unsupported file type. Supported: ${supportedTypes.join(', ')}`);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded">
      <h2 className="text-xl font-bold mb-4">Upload Any File</h2>

      <input
        type="file"
        onChange={handleFileChange}
        disabled={loading}
        accept={supportedTypes.join(',')}
        className="mb-4"
      />

      {file && <p className="mb-2 text-sm">Selected: {file.name}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Upload & Analyze'}
      </button>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="font-bold">File Type: {result.fileType}</p>
          <p className="font-bold">Analysis:</p>
          <p className="whitespace-pre-wrap">{result.result.analysis}</p>
        </div>
      )}
    </div>
  );
}
```


***

**Key points:**

1. **File filter validates MIME types** before upload.[^3][^4]
2. **Each file type gets a custom prompt** tailored to its content.[^5][^3]
3. **PDFs require base64 conversion** for Gemini API.[^5]
4. **Images, audio, and video** use `inlineData` with base64.[^3][^4]
5. **Text files** are processed directly as UTF-8 strings.[^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://ai.google.dev/gemini-api/docs/files

[^2]: https://ai.google.dev/api/files

[^3]: https://stackoverflow.com/questions/78888864/does-gemini-api-support-all-file-mime-types

[^4]: https://www.datastudios.org/post/gemini-file-upload-limits-and-supported-formats

[^5]: https://ai.google.dev/gemini-api/docs/document-processing

[^6]: https://firebase.google.com/docs/ai-logic/input-file-requirements

[^7]: https://support.google.com/gemini/answer/14903178?hl=en\&co=GENIE.Platform%3DAndroid

[^8]: https://patloeber.com/gemini-multimodal/

[^9]: https://www.datastudios.org/post/google-gemini-file-upload-limits-and-supported-file-types-updated-capabilities

[^10]: https://www.datastudios.org/post/google-ai-studio-pdf-reading-document-processing-limits-multimodal-parsing-and-workflow-optimiza

[^11]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/base64-encode

[^12]: https://stackoverflow.com/questions/78316397/access-pdf-files-using-the-gemini-api

[^13]: https://cloud.google.com/vertex-ai/generative-ai/docs/image/base64-encode

[^14]: https://www.raymondcamden.com/2024/05/21/using-the-gemini-file-api-for-prompts-with-media

[^15]: https://firebase.google.com/docs/ai-logic/analyze-documents

[^16]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference

[^17]: https://workspaceupdates.googleblog.com/2024/08/upload-documents-into-gemini-for-insights-and-analysis.html

[^18]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/document-understanding

[^19]: https://github.com/google/generative-ai-docs/blob/main/site/en/gemini-api/docs/vision.ipynb

[^20]: https://www.reddit.com/r/Bard/comments/1hh4j03/please_add_support_for_more_files_types_for_the/

