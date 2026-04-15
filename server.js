const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// 🔍 DEBUG ENV
console.log("🔍 GOOGLE_CREDENTIALS:", process.env.GOOGLE_CREDENTIALS ? "EXISTE ✅" : "MANQUANT ❌");

// 🔐 Parse credentials
let credentials;

try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
  console.log("✅ JSON PARSÉ OK");
} catch (err) {
  console.error("❌ ERREUR PARSE JSON:", err);
}

// 🔐 Google Auth
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"]
});

const drive = google.drive({ version: "v3", auth });

// 📤 Upload vers Google Drive (VERSION FIXÉE)
async function uploadToDrive(filePath, fileName) {
  try {
    console.log("📤 Upload en cours vers Drive...");

    const response = await drive.files.create({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      requestBody: {
        name: fileName,
        parents: ["1CtSfuBQCGqF7fgNFRSRlYUt7RLK8Aey8"], // ✅ ton dossier partagé
        mimeType: "application/pdf"
      },
      media: {
        mimeType: "application/pdf",
        body: fs.createReadStream(filePath)
      }
    });

    console.log("✅ Upload réussi:", response.data);

    const fileId = response.data.id;

    // 🔓 rendre public
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone"
      }
    });

    console.log("🔓 Permission publique activée");

    return `https://drive.google.com/file/d/${fileId}/view`;

  } catch (error) {
    console.error("❌ ERREUR DRIVE COMPLETE:", error);
    throw new Error("Upload Drive échoué");
  }
}

// 🟢 Route test
app.get('/', (req, res) => {
  res.send("✅ ADNAYA SERVER IS RUNNING");
});

// 📄 Endpoint principal
app.post('/generate-pdf', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Le champ 'text' est requis"
      });
    }

    const fileName = `file_${Date.now()}.pdf`;
    const filePath = `/tmp/${fileName}`;

    console.log("📄 Génération PDF...");

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);
    doc.fontSize(14).text(text);
    doc.end();

    stream.on('finish', async () => {
      console.log("✅ PDF généré:", fileName);

      try {
        const driveLink = await uploadToDrive(filePath, fileName);

        res.json({
          success: true,
          pdf_url: driveLink
        });

      } catch (err) {
        console.error("❌ Upload échoué:", err.message);

        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    stream.on('error', (err) => {
      console.error("❌ Erreur stream:", err);

      res.status(500).json({
        success: false,
        error: "Erreur génération PDF"
      });
    });

  } catch (error) {
    console.error("❌ Erreur serveur globale:", error);

    res.status(500).json({
      success: false,
      error: "Erreur serveur"
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
