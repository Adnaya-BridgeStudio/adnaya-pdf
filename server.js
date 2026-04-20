const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { google } = require('googleapis');

const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const TOKEN_PATH = '/tmp/token.json';

const oauth2Client = new google.auth.OAuth2(
 process.env.GOOGLE_CLIENT_ID,
 process.env.GOOGLE_CLIENT_SECRET,
 process.env.GOOGLE_REDIRECT_URI
);

// =======================
// TOKEN
// =======================

if (fs.existsSync(TOKEN_PATH)) {
 const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
 oauth2Client.setCredentials(tokens);
 console.log("✅ Token chargé");
}

// =======================
// AUTH
// =======================

app.get('/auth', (req,res)=>{

 const url = oauth2Client.generateAuthUrl({
   access_type:'offline',
   scope:['https://www.googleapis.com/auth/drive.file']
 });

 res.redirect(url);

});


app.get('/auth/callback', async(req,res)=>{

 const { code } = req.query;

 const { tokens } = await oauth2Client.getToken(code);

 oauth2Client.setCredentials(tokens);

 fs.writeFileSync(
   TOKEN_PATH,
   JSON.stringify(tokens)
 );

 console.log("✅ CONNECTÉ À GOOGLE DRIVE");

 res.send("Google Drive connecté ✅");

});


// =======================
// UPLOAD DRIVE
// =======================

async function uploadToDrive(
 filePath,
 fileName,
 mimeType='application/pdf'
){

 const drive = google.drive({
   version:'v3',
   auth:oauth2Client
 });

 const response = await drive.files.create({

   requestBody:{
      name:fileName,
      parents:["1CtSfuBQCGqF7fgNFRSRlYUt7RLK8Aey8"]
   },

   media:{
      mimeType:mimeType,
      body:fs.createReadStream(filePath)
   }

 });

 const fileId = response.data.id;

 await drive.permissions.create({
   fileId,
   requestBody:{
      role:'reader',
      type:'anyone'
   }
 });

 return `https://drive.google.com/file/d/${fileId}/view`;

}


// =======================
// TEST
// =======================

app.get('/',(req,res)=>{
 res.send("✅ ADNAYA SERVER IS RUNNING");
});


// =======================
// PDF
// =======================

app.post('/generate-pdf', async(req,res)=>{

 try{

   const { text } = req.body;

   const fileName=`file_${Date.now()}.pdf`;

   const filePath=`/tmp/${fileName}`;

   const doc=new PDFDocument();

   const stream=fs.createWriteStream(filePath);

   doc.pipe(stream);

   doc.text(text);

   doc.end();

   stream.on('finish',async()=>{

      try{

       const link=await uploadToDrive(
         filePath,
         fileName,
         'application/pdf'
       );

       res.json({
         success:true,
         pdf_url:link
       });

      }

      catch(err){

       console.error(err);

       res.status(500).json({
         success:false,
         error:err.message
       });

      }

   });

 }

 catch(err){

   res.status(500).json({
      success:false,
      error:"Erreur serveur"
   });

 }

});


// =======================
// REQUETE CLIENT
// =======================

app.post('/submit-request', upload.single('file'), async(req,res)=>{

 try{

   const { text, contact } = req.body;

   const file=req.file;

   if(!text || !contact){

      return res.json({
        success:false,
        error:"Texte ou contact manquant"
      });

   }


   // 🔥 Nettoyage format texte
   const cleanText = text
      .replace(/\r\n/g,"\n")
      .replace(/\n{3,}/g,"\n\n")
      .trim();


   const date = new Date().toISOString().split('T')[0];


   // 🔥 ALIGNEMENT PROPRE
   const content =
`===== ADNAYA CLIENT REQUEST =====

Date: ${date}
Contact: ${contact}

-------------------------
DEMANDE CLIENT
-------------------------

${cleanText}

-------------------------
END REQUEST
-------------------------
`;


   const fileNameTxt=
   `REQUEST_${date}_${Date.now()}.txt`;

   const filePathTxt=
   `/tmp/${fileNameTxt}`;

   fs.writeFileSync(
     filePathTxt,
     content,
     'utf8'
   );


   // 🔥 upload txt propre
   await uploadToDrive(
      filePathTxt,
      fileNameTxt,
      'text/plain'
   );


   if(file){

      const fileName=
      `FILE_${date}_${file.originalname}`;

      await uploadToDrive(
         file.path,
         fileName,
         file.mimetype
      );

   }


   return res.json({
      success:true
   });


 }

 catch(err){

   console.error(
    "❌ ERREUR REQUETE:",
    err
   );

   return res.json({
     success:false,
     error:err.message
   });

 }

});



const PORT=
process.env.PORT || 10000;

app.listen(PORT,()=>{

 console.log(
 `🚀 Server running on port ${PORT}`
 );

});
