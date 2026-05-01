import { Router } from "express";
import {
     issuerController,
     authController,
     userinfoController,
     tokenController,
     keysController,
     consentPageController,
     consentSubmitController
} from './app.controller.js'
import { authMiddleware } from "./middleware/auth.middleware.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRouter = Router();

appRouter.get('/issuer', issuerController);
appRouter.get('/auth', authMiddleware, authController);
appRouter.post('/token',tokenController);
appRouter.get('/userinfo', userinfoController);
appRouter.get('/keys', keysController);

// Consent UI Routes
appRouter.get('/consent', consentPageController); //sends HTML
appRouter.post('/consent', consentSubmitController);
appRouter.get('/consent.css', (req, res) => { //internally called by html sends CSS
     res.sendFile(path.join(__dirname, 'ui', 'consent.css'));
});

export default appRouter;


