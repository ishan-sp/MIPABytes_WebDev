import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import morgan from "morgan";
import { body, validationResult } from 'express-validator';
import fs from "fs";
import path from "path";
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from "@google/generative-ai";
import cookieParser from "cookie-parser";
import user from './models/user.js';
import session from "express-session";
import connectMongoDBSession from "connect-mongodb-session";
mongoose.connect("mongodb://localhost:27017/tourism", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

// Path and app setup
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3005;
const MongoDBStore = connectMongoDBSession(session);
const store = new MongoDBStore({
  uri : "mongodb://localhost:27017/tourism",
  collection : "sessions",
});

// MongoDB Session store error handling
store.on('error', function(error) {
  console.error("Session Store Error: ", error);
});

// Logger setup
const logDirectory = path.join(__dirname, './log');
const logFile = path.join(logDirectory, 'access.log');
if (!fs.existsSync(logDirectory)) fs.mkdirSync(logDirectory);
const accessLogStream = fs.createWriteStream(logFile, { flags: 'a' });

// Generative AI Setup
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
  systemInstruction: "generate a json with very very short sentences for a tabular frontend, cuisine, local phrases native to the state that could help you communicate, format it nicely in bold or other format. your response will be directly embedded in small divs in frontend so just organise it well. Follow the json structure always and dont deviate as shown in examples. If given a place like visveswarya museum, you can refer to cuisine of karnataka and location related field to karnataka"
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 100,
  responseMimeType: "text/plain",
};

async function run(res, qur) {
  const chatSession = model.startChat({
    generationConfig,
 // safetySettings: Adjust safety settings
 // See https://ai.google.dev/gemini-api/docs/safety-settings
    history: [
      {
        role: "user",
        parts: [
          {text: "lalbagh\n"},
        ],
      },
      {
        role: "model",
        parts: [
          {text : '{"country":"India","state":"Karnataka","desc":"Lalbagh Botanical Garden, located in Bangalore, India, is a historic and expansive garden established in 1760 by King Hyder Ali and later developed by his son, Tipu Sultan. Spanning over 240 acres, Lalbagh is renowned for its diverse collection of tropical plants, beautiful landscapes, and prominent features such as the iconic Glass House, the picturesque lake, the unique Floral Clock, and the massive rock with a watchtower. This garden serves as a center for horticultural research and conservation while also being a popular recreational spot for visitors, offering a serene and scenic retreat in the heart of the bustling city.","cuisine":[{"name":"Dosa","description":"Dosa is a thin, crispy Indian pancake made from fermented rice and urad dal (black gram) batter, typically served with chutneys and sambar."},{"name":"Idly","description":"Idly is a soft, steamed cake made from a fermented batter of rice and urad dal, commonly served with chutneys and sambar for breakfast or as a snack."}],"phrases":[{"phrase":"Namaskara (ನಮಸ್ಕಾರ)","translation":"Hello / Greetings"},{"phrase":"Hegiddira? (ಹೇಗಿದ್ದೀರಾ?)","translation":"How are you?"},{"phrase":"Naanu sariyagi Kannada helthini (ನಾನು ಸರಿಯಾಗಿ ಕನ್ನಡ ಹೇಳ್ತಿನಿ)","translation":"I speak Kannada well."}]}'},
        ],
      },
      {
        role: "user",
        parts: [
          {text: "delhi\n"},
        ],
      },
      {
        role: "model",
        parts: [
          {text : '{"country":"India","state":"Delhi","desc":"Delhi, the capital of India, is a vibrant metropolis known for its rich history, bustling markets, iconic landmarks like the Red Fort and India Gate, and its status as a political and cultural hub.","cuisine":[{"name":"Chole Bhature","description":"Chole Bhature is a popular Delhi street food consisting of spicy chickpeas (chole) served with deep-fried bread (bhature)."},{"name":"Paratha","description":"Paratha is a flat, unleavened Indian bread, often stuffed with various fillings like potatoes, paneer, or cauliflower, and served with yogurt, pickle, and curry."},{"name":"Butter Chicken","description":"Butter Chicken is a rich and creamy curry made with chicken cooked in a tomato-based sauce, flavored with butter, cream, and Indian spices."}],"phrases":[{"phrase":"Namaste (नमस्ते)","translation":"Hello / Greetings"},{"phrase":"Aap kaise hain? (आप कैसे हैं?)","translation":"How are you?"},{"phrase":"Main Dilliwala hoon (मैं दिल्लीवाला हूँ)","translation":"I am from Delhi."}]}'},
        ],
      },
    ],
  });
  const result = await chatSession.sendMessage(qur);
  res.json({response : result.response.text()});
  console.log(result.response.text());
}

// Middleware setup
app.use(session({
  secret: "s3cUr3$K3y@123!",
  saveUninitialized: false,
  resave: false,
  cookie: { maxAge: 182 * 24 * 60 * 60 * 1000 },
  store: store,
}));

// Body parser for handling request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Static files setup (landing page, etc.)
app.use(express.static(__dirname));

// Log all incoming requests
app.use(morgan('combined', { stream: accessLogStream }));

// Main route (landing page)
app.get("/", (req, res) => {
  const sessionUserId = req.session.userId;
  if (sessionUserId) {
    res.redirect("/main");
    return;
  }
  res.sendFile(path.join(__dirname, "./landing.html"));
});

app.get("/main", (req, res) => {
    const sessionUserId = req.session.userId;
    if(sessionUserId) {
        console.log(sessionUserId);
        console.log("user is found ans was redirected to main");
    }
    res.sendFile(path.join(__dirname, "./main.html"));
});

app.post(
    "/signup",
    body("password")
      .notEmpty().withMessage("Password cannot be empty")
      .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    
    body("name")
      .notEmpty().withMessage("Name is required"),
  
    body("email")
      .isEmail().withMessage("Please enter a valid email")
      .normalizeEmail()
      .notEmpty().withMessage("Email cannot be empty"),
    
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { name, email, password } = req.body;
  
      try {
        const findName = await user.findOne({ name });
        const findEmail = await user.findOne({ email });
  
        if (findName) return res.status(400).json({ message: "Name already exists" });
        if (findEmail) return res.status(400).json({ message: "Account with this email already exists" });
  
        const newUser = new user({ name, email, password });
        await newUser.save();
  
        req.session.userId = newUser._id;
  
        res.redirect("/main");
      } catch (err) {
        return res.status(500).send("Server error. Please try again later.");
      }
    }
  );
app.post("/login", async (req, res) => {
    console.log("Reached login route");
  
    // Check if user is already logged in (session exists)
    if (req.session.userId) {
      return res.redirect("/main"); // Redirect to /main if session already exists
    }
  
    const { email, password } = req.body;
  
    try {
      // Find user by email and password
      const logUser = await user.findOne({ email, password });
  
      if (logUser) {
        req.session.userId = logUser._id;  // Store user ID in session
        console.log("Login successful");
        return res.redirect("/main"); // Redirect to /main after successful login
      } else {
        console.log("Invalid credentials");
        return res.status(401).send("Invalid email or password");
      }
    } catch (err) {
      console.error("Server error:", err);
      return res.status(500).send("Server error. Please try again later.");
    }
  });

  app.post("/map", async (req, res) => {
    console.log("Entering map");
    const data = req.body;
    console.log(data);
    res.json({data});
});

app.post("/map/message", (req, res) => {
  const qr = req.body;
  console.log("The req.body received is:", qr);  // This should now properly log the parsed JSON object
  const usermessage = qr.usermsg;
  console.log("User message is:", usermessage);
  run(res, usermessage);
});

  

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    res.redirect("/");
  });
});

// AI Query route (for handling user queries)
app.post('/query', (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).send('Query parameter is required');
  }

  runAI(res, query);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
