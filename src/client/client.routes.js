import { Router } from 'express'
import path from 'path';
import { fileURLToPath } from 'url';
import { registerClientController } from '../client/client.controller.js'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientRouter = Router()

// GET: Serve the client registration page
clientRouter.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

// GET: Serve the client CSS
clientRouter.get('/client.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'client.css'));
});

// GET: Serve the registration success page
clientRouter.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'success.html'));
});

// POST: Handle client registration
clientRouter.post('/register', registerClientController);

export default clientRouter
