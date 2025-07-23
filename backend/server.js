const express = require('express');
const { spawn } = require('child_process');
const admin = require('firebase-admin');
// const nodemailer = require('nodemailer'); // Example using Nodemailer

// Initialize Firebase Admin SDK (replace with your service account credentials)
// Make sure to set the GOOGLE_APPLICATION_CREDENTIALS environment variable
// or provide the service account key file path directly.
admin.initializeApp({
  // credential: admin.credential.cert(require('./path/to/your/serviceAccountKey.json'))
});

const db = admin.firestore();
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// --- Email Sending Function (Placeholder) ---
// Replace with your actual email sending logic using a service like SendGrid, Mailgun, or Nodemailer
const sendPriceChangeEmail = async (item, oldPrice, newPrice) => {
  console.log(`TODO: Sending email for price change on ${item.url}`);
  console.log(`Price changed from ${oldPrice} to ${newPrice}`);

  // Example using Nodemailer (uncomment and configure if using)
  /*
  try {
    let transporter = nodemailer.createTransport({
      service: 'gmail', // Or your email service
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password' // Use environment variables or a secure method for passwords
      }
    });

    let info = await transporter.sendMail({
      from: '"Price Tracker" <your-email@gmail.com>',
      to: 'your-recipient-email@example.com', // Your email address
      subject: 'Price Change Alert!',
      text: `The price for ${item.url} has changed from ${oldPrice} to ${newPrice}.`,
      html: `<p>The price for <a href="${item.url}">${item.url}</a> has changed from ${oldPrice} to ${newPrice}.</p>`,
    });

    console.log('Email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
  */
};
// --- End of Email Sending Function ---

// Endpoint for testing crawls
app.post('/test-crawl', (req, res) => {
  const { url, selector } = req.body;

  if (!url || !selector) {
    return res.status(400).json({ error: 'URL and selector are required' });
  }

  // Execute the Python crawler script
  const pythonProcess = spawn('python3', ['crawling/crawler.py', url, selector]);

  let stdoutData = '';
  let stderrData = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
    console.error(`Crawler Error: ${data}`); // Log errors from the crawler
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        const result = JSON.parse(stdoutData);
        if (result.success) {
          res.json({ success: true, price: result.price });
        } else {
          res.status(500).json({ success: false, error: result.error });
        }
      } catch (error) {
        console.error('Error parsing crawler output:', error);
        res.status(500).json({ success: false, error: 'Error processing crawler output' });
      }
    } else {
      console.error(`Crawler process exited with code ${code}`);
      console.error(`Crawler Stderr: ${stderrData}`);
      res.status(500).json({ success: false, error: 'Crawler script failed' });
    }
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start crawler process:', err);
    res.status(500).json({ success: false, error: 'Failed to run crawler script' });
  });
});

// Endpoint for adding a new item (after successful test crawl)
app.post('/items', async (req, res) => {
  const { url, selector } = req.body;

  if (!url || !selector) {
    return res.status(400).json({ error: 'URL and selector are required' });
  }

  try {
    // Add the item to Firestore
    const docRef = await db.collection('items').add({
      url,
      selector,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const itemId = docRef.id;
    console.log(`Item added with ID: ${itemId}`);

    res.status(201).json({ success: true, itemId });
  } catch (error) {
    console.error('Error adding item to Firestore:', error);
    res.status(500).json({ success: false, error: 'Error adding item' });
  }
});

// Endpoint to get all items
app.get('/items', async (req, res) => {
  try {
    const itemsSnapshot = await db.collection('items').get();
    const items = [];
    itemsSnapshot.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() });
    });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error getting items from Firestore:', error);
    res.status(500).json({ success: false, error: 'Error getting items' });
  }
});

// Endpoint to get crawling history for an item
app.get('/items/:itemId/history', async (req, res) => {
  const itemId = req.params.itemId;

  try {
    const historySnapshot = await db.collection('items').doc(itemId).collection('history').orderBy('timestamp', 'desc').get();
    const history = [];
    historySnapshot.forEach(doc => {
      history.push({ id: doc.id, ...doc.data() });
    });
    res.json({ success: true, history });
  } catch (error) {
    console.error(`Error getting history for item ${itemId} from Firestore:`, error);
    res.status(500).json({ success: false, error: 'Error getting item history' });
  }
});

// Endpoint for scheduled crawling of all items
app.post('/crawl-all', async (req, res) => {
  try {
    console.log('Starting scheduled crawl...');
    const itemsSnapshot = await db.collection('items').get();

    const crawlPromises = [];

    itemsSnapshot.forEach(doc => {
      const item = { id: doc.id, ...doc.data() };
      console.log(`Crawling item: ${item.url}`);

      const crawlPromise = new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['crawling/crawler.py', item.url, item.selector]);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          stderrData += data.toString();
          console.error(`Crawler Error for ${item.url}: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdoutData);
              if (result.success) {
                const crawledPrice = result.price;
                console.log(`Successfully crawled ${item.url}, price: ${crawledPrice}`);

                // --- Price Change Detection and Email Notification --- //
                const historySnapshot = await db.collection('items').doc(item.id).collection('history').orderBy('timestamp', 'desc').limit(1).get();
                const lastPrice = historySnapshot.empty ? null : historySnapshot.docs[0].data().price;

                if (lastPrice !== null && crawledPrice !== lastPrice) { // Simple price change check
                  console.log(`Price changed for ${item.url}: ${lastPrice} -> ${crawledPrice}`);
                  await sendPriceChangeEmail(item, lastPrice, crawledPrice); // Call the email function
                }
                // --- End of Price Change Detection and Email Notification --- //

                // Store the crawl result in history
                await db.collection('items').doc(item.id).collection('history').add({
                  price: crawledPrice,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });

                resolve({ itemId: item.id, success: true, price: crawledPrice });
              } else {
                console.error(`Crawler failed for ${item.url}: ${result.error}`);
                resolve({ itemId: item.id, success: false, error: result.error });
              }
            } catch (error) {
              console.error(`Error processing crawl output for ${item.url}:`, error);
              resolve({ itemId: item.id, success: false, error: 'Error processing crawler output' });
            }
          } else {
            console.error(`Crawler process exited with code ${code} for ${item.url}`);
            console.error(`Crawler Stderr for ${item.url}: ${stderrData}`);
            resolve({ itemId: item.id, success: false, error: 'Crawler script failed' });
          }
        });

        pythonProcess.on('error', (err) => {
          console.error(`Failed to start crawler process for ${item.url}:`, err);
          resolve({ itemId: item.id, success: false, error: 'Failed to run crawler script' });
        });
      });

      crawlPromises.push(crawlPromise);
    });

    // Wait for all crawl promises to complete
    const crawlResults = await Promise.all(crawlPromises);

    console.log('Scheduled crawl finished.');
    res.json({ success: true, results: crawlResults });

  } catch (error) {
    console.error('Error during scheduled crawl:', error);
    res.status(500).json({ success: false, error: 'Internal server error during scheduled crawl' });
  }
});

app.get('/', (req, res) => {
  res.send('Price Tracker Backend');
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
