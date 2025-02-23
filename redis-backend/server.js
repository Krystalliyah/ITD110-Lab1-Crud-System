const express = require('express');
const redis = require('redis');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create single Redis client
const client = redis.createClient({
    url: 'redis://@127.0.0.1:6379'
});

// Redis connection handling
client.on('error', (err) => console.error('Redis Client Error:', err));

// Connect to Redis before setting up routes
(async () => {
    try {
        await client.connect();
        console.log('Connected to Redis');

        // Middleware
        app.use(cors());
        app.use(bodyParser.json());

        // Pass Redis client to auth routes
        const authRoutes = require('./Auth')(client);  // Pass client to Auth.js
        app.use('/', authRoutes);

        // RBAC
        const SECRET_KEY = "your_secret_key";

        const users = {
            user1: { username: "user1", password: "pass123", role: "admin" },
            user2: { username: "user2", password: "pass123", role: "user" },
        };

        // Login endpoint
        app.post("/login", async (req, res) => {
            const { username, password } = req.body;
            const user = users[username];

            if (!user || user.password !== password) {
                return res.status(401).json({ message: "Invalid credentials" });
            }

            // Generate token & store role in Redis
            const token = jwt.sign({ username, role: user.role }, SECRET_KEY, { expiresIn: "1h" });
            await client.set(username, user.role);

            res.json({ token, role: user.role });
        });

        // Get user role from Redis
        app.get("/role/:username", async (req, res) => {
            const role = await client.get(req.params.username);
            res.json({ role });
        });


        // --------------------      CRUD Operations - PATIENT DATA ------------------------------------------ //
       



app.post('/patients', async (req, res) => {
  const { id, firstname, lastname, appoint_date, appoint_type, age, address, email,pnumber } = req.body;




  // Validate input fields
  if (!id || !firstname || !lastname ||  !appoint_date || !appoint_type ||  !age || !address || !email || !pnumber ) {
    return res.status(400).json({ message: 'All fields are required' });
  }


  try {
    // Set patient data in Redis (using object syntax for Redis v4 and above)
    const patientData = { firstname, lastname, appoint_date, appoint_type, age, address, email, pnumber };


    // Save patient data in Redis hash
    await client.hSet(`patient:${id}`, 'firstname', patientData.firstname);
    await client.hSet(`patient:${id}`, 'lastname', patientData.lastname);
    await client.hSet(`patient:${id}`, 'appoint_date', patientData.appoint_date);
    await client.hSet(`patient:${id}`, 'appoint_type', patientData.appoint_type);
    await client.hSet(`patient:${id}`, 'age', patientData.age);
    await client.hSet(`patient:${id}`, 'address', patientData.address);
    await client.hSet(`patient:${id}`, 'email', patientData.email);
    await client.hSet(`patient:${id}`, 'pnumber', patientData.pnumber);




    // Respond with success message
    res.status(201).json({ message: 'patient saved successfully' });
  } catch (error) {
    console.error('Error saving patient:', error);
    res.status(500).json({ message: 'Failed to save patient' });
  }
});

      


// Read all patients
app.get('/patients', async (req, res) => {
  const keys = await client.keys('patient:*');
  const patients = await Promise.all(keys.map(async (key) => {
    return { id: key.split(':')[1], ...(await client.hGetAll(key)) };
  }));
  res.json(patients);
});


// Update (U)
app.put('/patients/:id', async (req, res) => {
  const id = req.params.id;
  const { firstname, lastname, appoint_date, appoint_type, age, address, email, pnumber } = req.body;


  if (!firstname && !lastname && !appoint_date &&!appoint_type && !age && !address && !email && !pnumber) {
    return res.status(400).json({ message: 'At least one field is required to update' });
  }


  try {
    const existingpatient = await client.hGetAll(`patient:${id}`);
    if (Object.keys(existingpatient).length === 0) {
      return res.status(404).json({ message: 'patient not found' });
    }


    // Update patient data in Redis
    if (firstname) await client.hSet(`patient:${id}`, 'firstname', firstname);
    if (lastname) await client.hSet(`patient:${id}`, 'lastname', lastname);
    if (appoint_date) await client.hSet(`patient:${id}`, 'appoint_date', appoint_date);
    if (appoint_type) await client.hSet(`patient:${id}`, 'appoint_type', appoint_type);
    if (age) await client.hSet(`patient:${id}`, 'age', age);
    if (address) await client.hSet(`patient:${id}`, 'address', address);
    if (email) await client.hSet(`patient:${id}`, 'email', email);
    if (pnumber) await client.hSet(`patient:${id}`, 'pnumber', pnumber);
   


    res.status(200).json({ message: 'patient updated successfully' });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ message: 'Failed to update patient' });
  }
});


// Delete (D)
app.delete('/patients/:id', async (req, res) => {
  const id = req.params.id;
  await client.del(`patient:${id}`);
  res.status(200).json({ message: 'patient deleted successfully' });
});


  // --------------------      CRUD Operations - MEDICAL RECORDS  ------------------------------------------ //


  //CREATE OR ADD
app.post('/patients/:id/medical-record', async (req, res) => {
  const id = req.params.id;
  const { diagnosis, treatment, prescription, notes } = req.body;

  try {
    // Check Redis connection
    if (!client.isOpen) {
      return res.status(500).json({ message: 'Database connection error' });
    }

    // Save each field individually
    await client.hSet(`medical_record:${id}`, 'diagnosis', diagnosis || '');
    await client.hSet(`medical_record:${id}`, 'treatment', treatment || '');
    await client.hSet(`medical_record:${id}`, 'prescription', prescription || '');
    await client.hSet(`medical_record:${id}`, 'notes', notes || '');

    res.status(201).json({ message: 'Medical record saved successfully' });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ 
      message: 'Failed to save medical record',
      details: error.message 
    });
  }
});

// READ OR FETCH DATA
app.get('/patients/:id/medical-record', async (req, res) => {
  const patientId = req.params.id;
  console.log(`Retrieving medical record for patient ID: ${patientId}`);
  
  try {
    // First check if the patient exists
    const patient = await client.hGetAll(`patient:${patientId}`);
    if (Object.keys(patient).length === 0) {
      console.log(`Patient ${patientId} not found`);
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    // Then try to get their medical record
    const medicalRecord = await client.hGetAll(`medical_record:${patientId}`);
    
    if (Object.keys(medicalRecord).length === 0) {
      console.log(`No medical record found for patient ${patientId}, returning empty record`);
      // Return an empty record with a 200 status instead of 404
      return res.status(200).json({
        diagnosis: '',
        treatment: '',
        prescription: '',
        notes: ''
      });
    }
    
    console.log("Retrieved medical record from DB:", medicalRecord);
    res.json(medicalRecord);
  } catch (error) {
    console.error('Error fetching medical record:', error);
    res.status(500).json({ message: 'Error fetching medical record' });
  }
});



// Update Medical Record
app.put('/patients/:id/medical-record', async (req, res) => {
  const patientId  = req.params.id;
  const { diagnosis, treatment, prescription, notes } = req.body;

  try {
    const existingRecord = await client.hGetAll(`medical_record:${patientId}`);
    if (Object.keys(existingRecord).length === 0) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    await client.hSet(`medical_record:${patientId}`, {
      ...(diagnosis && { diagnosis }),
      ...(treatment && { treatment }),
      ...(prescription && { prescription }),
      ...(notes && { notes })
    });

    res.status(200).json({ message: 'Medical record updated successfully' });
  } catch (error) {
    console.error('Error updating medical record:', error);
    res.status(500).json({ message: 'Failed to update medical record' });
  }
});

// Delete Medical Record - No option integrated for delete medical record but dre lang ni for future use
app.delete('/patients/:id/medical-record', async (req, res) => {
  const id = req.params.id;
  await client.del(`medical_record:${id}`);
  res.status(200).json({ message: 'Medical record deleted successfully' });
});

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('Failed to connect to Redis:', err);
        process.exit(1);
    }
})();