<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Show a minimal file upload and parsing flow for PDFs

Here is a minimal backend‑only flow: upload a PDF with Express + Multer, then send its bytes to Gemini for parsing.

***

## 1. Install dependencies

```bash
npm install express multer dotenv @google/generative-ai
npm install -D typescript ts-node nodemon @types/express @types/node @types/multer
```

Create a `.env`:

```bash
GEMINI_API_KEY=YOUR_KEY_HERE
PORT=5000
```


***

## 2. Basic Express + Multer setup

```ts
// index.ts
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // keep file in RAM [web:29]

app.use(express.json());
```

A simple PDF‑only upload endpoint:

```ts
app.post('/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // req.file.buffer contains the PDF bytes
    const pdfBuffer = req.file.buffer;

    // Call Gemini to parse it (next section)
    const parsed = await parsePdfWithGemini(pdfBuffer);

    return res.json({
      fileName: req.file.originalname,
      text: parsed.text,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
```


***

## 3. Minimal Gemini “parse PDF” helper

Gemini can read raw PDF bytes directly and return a summary or extracted text.[^1][^2]

```ts
// gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY!;
const client = new GoogleGenerativeAI(apiKey);

export async function parsePdfWithGemini(pdfBuffer: Buffer) {
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: pdfBuffer.toString('base64'),
              mimeType: 'application/pdf',
            },
          },
          {
            text: 'Extract the main text content of this PDF.',
          },
        ],
      },
    ],
  }); // [web:27][web:8]

  const text = result.response.text();
  return { text };
}
```

Then import and use it in `index.ts`:

```ts
import { parsePdfWithGemini } from './gemini';
```


***

## 4. Example client request

Using `curl`:

```bash
curl -X POST http://localhost:5000/upload-pdf \
  -F "file=@/path/to/your.pdf"
```

The JSON response will contain the original filename and Gemini’s extracted text.[^1][^2]

If you want, the next step can be wiring this into your existing React frontend so uploads from the browser hit `/upload-pdf`.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://ai.google.dev/gemini-api/docs/document-processing

[^2]: https://ai.google.dev/gemini-api/docs/file-search

[^3]: https://stackoverflow.com/questions/56491896/using-multer-and-express-with-typescript

[^4]: https://blog.logrocket.com/multer-nodejs-express-upload-file/

[^5]: https://www.youtube.com/watch?v=i8yxx6V9UdM

[^6]: https://betterstack.com/community/guides/scaling-nodejs/multer-in-nodejs/

[^7]: https://stackoverflow.com/questions/62136514/how-to-save-pdf-file-in-node-js-with-express-and-multer

[^8]: https://geminibyexample.com/018-structured-data-extraction/

[^9]: https://expressjs.com/en/resources/middleware/multer.html

[^10]: https://www.raymondcamden.com/2024/09/05/using-pdf-content-with-google-gemini-an-update

[^11]: https://www.raymondcamden.com/2024/03/22/using-pdf-content-with-google-gemini

[^12]: https://www.reddit.com/r/node/comments/sardky/how_do_i_upload_to_multer_from_within_node/

[^13]: https://www.raymondcamden.com/2025/11/17/gemini-file-search-file-stores-for-easy-rag

[^14]: https://cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-gemini-pdf

[^15]: https://dev.to/joaosczip/build-a-file-upload-service-with-nodejs-typescript-clean-architecture-and-aws-s3-3h9b

[^16]: https://www.youtube.com/watch?v=4Kb6MxL2sP4

[^17]: https://deadsimplechat.com/blog/file-upload-using-nodejs-multer-express/

[^18]: https://pinggy.io/blog/how_to_use_file_search_tool_in_gemini_api_for_easy_rag_integration/

[^19]: https://www.reddit.com/r/GoogleGeminiAI/comments/1d0wssp/send_pdf_files_to_gemini_via_api/

[^20]: https://docs.nestjs.com/techniques/file-upload

