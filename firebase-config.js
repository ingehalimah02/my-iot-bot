import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import dotenv from "dotenv";
dotenv.config();

const firebaseConfig = {
  databaseURL: process.env.FIREBASE_URL
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue };
