const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


require('dotenv').config();  // Load environment variables

const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';

// Export the router with Redis client
module.exports = function(client) {
    router.post('/register', async (req, res) => {
        try {
            const { email, password } = req.body;

            // Check if user already exists
            const existingUser = await client.hGetAll(`user:${email}`);
            if (existingUser.password) {
                return res.json({ success: false, message: 'User already exists' });
            }

            // Hash password and save user
            const hashedPassword = await bcrypt.hash(password, 10);
            await client.hSet(`user:${email}`, 'password', hashedPassword);
            await client.hSet(`user:${email}`, 'role', 'user');

            res.json({ success: true, message: 'Registration successful' });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ success: false, message: 'Server error during registration' });
        }
    });

    // Login endpoint
    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await client.hGetAll(`user:${email}`);
            if (!user.password) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' });
            }

            // Generate token
            const token = jwt.sign({ email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

            res.json({ success: true, user: { email, role: user.role }, token });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: `Server error during login: ${error.message}` });
        }
    });

    return router;
};
