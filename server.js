const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// 🔐 Connexion Google Drive
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive.file"]
});

const drive = google.drive({ version: "v3", auth });

// 📤 Upload vers Google Drive
async function uploadToDrive(filePath, fileName) {
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/pdf"
    },
    media: {
      mimeType: "application/pdf",
      body: fs.createReadStream(filePath)
    }
  });

  const fileId = response.data.id;

  // rendre public
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone"
    }
  });

  return `https://drive.google.com/file/d/${fileId}/view`;
}

// 📄 Endpoint principal
app.post('/generate-pdf', async (req, res) => {
  try {
    const { text } = req.body;

    const fileName = `file_${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(14).text(text);
    doc.end();

    doc.on('finish', async () => {
      const link = await uploadToDrive(filePath, fileName);

      res.json({
        success: true,
        pdf_url: link
      });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 Port Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
