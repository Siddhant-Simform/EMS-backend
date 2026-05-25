const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

let blobServiceClient = null;
let containerClient = null;

const isAzureConfigured = process.env.AZURE_STORAGE_CONNECTION_STRING &&
  !process.env.AZURE_STORAGE_CONNECTION_STRING.includes('your_account_name') &&
  !process.env.AZURE_STORAGE_CONNECTION_STRING.includes('your_account_key');

if (isAzureConfigured) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'employees';
    containerClient = blobServiceClient.getContainerClient(containerName);
    console.log(`🔌 Azure Blob Storage client initialized. Container: "${containerName}"`);
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage Client:', error.message);
  }
} else {
  console.log('⚠️  Using default/sample Azure Storage connection string.');
  console.log('👉 Local file system will be used to store employee uploads.');
}

/**
 * Uploads a file buffer to Azure Blob Storage or falls back to local disk
 * @param {Buffer} fileBuffer - The file content
 * @param {string} originalName - Original filename
 * @param {string} mimeType - The mime type of the file
 * @returns {Promise<string>} - The URL of the uploaded file
 */
const uploadFile = async (fileBuffer, originalName, mimeType) => {
  const extension = path.extname(originalName);
  const cleanName = path.basename(originalName, extension)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();
  const filename = `${Date.now()}-${cleanName}${extension}`;

  // If Azure is configured and working
  if (containerClient) {
    try {
      // Ensure container exists with public access for blobs
      await containerClient.createIfNotExists({
        access: 'blob'
      });
      
      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: { blobContentType: mimeType }
      });
      
      console.log(`☁️ File uploaded to Azure Blob Storage: ${filename}`);
      return blockBlobClient.url;
    } catch (error) {
      console.error('❌ Azure Blob upload failed, falling back to local file system:', error.message);
    }
  }

  // Fallback: Local file system
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const localFilePath = path.join(uploadsDir, filename);
    fs.writeFileSync(localFilePath, fileBuffer);
    console.log(`💾 File saved to local storage: ${filename}`);
    
    // Returns a relative URL that our Express server will serve static files from
    return `/uploads/${filename}`;
  } catch (error) {
    console.error('❌ Local file write failed:', error.message);
    throw new Error('File upload failed.');
  }
};

/**
 * Deletes a file from Azure Blob Storage or local storage
 * @param {string} fileUrl - The full URL or local static path of the file
 */
const deleteFile = async (fileUrl) => {
  if (!fileUrl) return;

  // Case 1: Azure Storage URL
  if (fileUrl.includes('blob.core.windows.net') && containerClient) {
    try {
      const filename = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
      const blockBlobClient = containerClient.getBlockBlobClient(filename);
      await blockBlobClient.deleteIfExists();
      console.log(`☁️ Deleted blob from Azure: ${filename}`);
    } catch (error) {
      console.error('❌ Failed to delete Azure blob:', error.message);
    }
    return;
  }

  // Case 2: Local URL (/uploads/filename)
  if (fileUrl.startsWith('/uploads/')) {
    try {
      const filename = fileUrl.replace('/uploads/', '');
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`💾 Deleted file from local storage: ${filename}`);
      }
    } catch (error) {
      console.error('❌ Failed to delete local file:', error.message);
    }
  }
};

module.exports = {
  uploadFile,
  deleteFile
};
