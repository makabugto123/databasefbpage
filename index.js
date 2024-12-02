const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const TOKEN_DIR = path.join(__dirname, 'token');

// Ensure the token directory exists
if (!fs.existsSync(TOKEN_DIR)) {
  fs.mkdirSync(TOKEN_DIR);
}

// Generate a random access key
const generateAccessKey = () => crypto.randomBytes(16).toString('hex');

// Function to fetch page details using the token
const getPageDetails = async (token) => {
  try {
    const response = await axios.get(`https://graph.facebook.com/v15.0/me`, {
      params: { access_token: token },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching page details:', error.message);
    throw new Error('Failed to fetch page details. Ensure the token is valid.');
  }
};

// /create endpoint
app.get('/create', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    // Fetch the real page details
    const pageDetails = await getPageDetails(token);
    const existingFiles = fs.readdirSync(TOKEN_DIR);
    
    // Check if a file with the same name already exists
    for (const file of existingFiles) {
      const filePath = path.join(TOKEN_DIR, file);
      const fileData = JSON.parse(fs.readFileSync(filePath));

      if (fileData.name === pageDetails.name) {
        return res.status(409).json({ error: 'A token with this name already exists.' });
      }
    }

    // Generate a new access key and create the data
    const accessKey = generateAccessKey();
    const data = {
      name: pageDetails.name,
      id: pageDetails.id,
      token,
      accessKey,
    };

    // Save the new token data to a file
    const filePath = path.join(TOKEN_DIR, `${pageDetails.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({
      message: 'Successfully created!',
      name: pageDetails.name,
      id: pageDetails.id,
      accessKey,
    });
  } catch (error) {
    console.error('Error in /create:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// /delete endpoint
app.get('/delete', (req, res) => {
  const { token, accesskey } = req.query;

  if (!token || !accesskey) {
    return res.status(400).json({ error: 'Token and AccessKey are required.' });
  }

  const files = fs.readdirSync(TOKEN_DIR);

  for (const file of files) {
    const filePath = path.join(TOKEN_DIR, file);
    const fileData = JSON.parse(fs.readFileSync(filePath));

    if (fileData.token === token && fileData.accessKey === accesskey) {
      fs.unlinkSync(filePath);
      return res.json({ message: 'Successfully deleted!' });
    }
  }

  res.status(404).json({ error: 'No matching record found.' });
});

// /find endpoint
app.get('/find', (req, res) => {
  const { json } = req.query;

  if (!json) {
    return res.status(400).json({ error: 'JSON file name is required.' });
  }

  const filePath = path.join(TOKEN_DIR, json);

  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath));
    return res.json(data);
  }

  res.status(404).json({ error: 'File not found.' });
});

//total endpoint to count all stored JSON data
app.get('/total', (req, res) => {
  try {
    const files = fs.readdirSync(TOKEN_DIR);
    res.json({ total: files.length });
  } catch (error) {
    console.error('Error in /total:', error.message);
    res.status(500).json({ error: 'Failed to count JSON files.' });
  }
});

// Server initialization
const PORT = process.env.PORT || 20422;
app.listen(PORT, () => {
  console.log(`Internal server is running on port ${PORT}`);
});
