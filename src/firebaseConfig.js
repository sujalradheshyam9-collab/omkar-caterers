import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-T8BR_n0pKNqN_MXqy1HUi5g7wVr73Ww",
  authDomain: "omkar-caterers.firebaseapp.com",
  projectId: "omkar-caterers",
  storageBucket: "omkar-caterers.firebasestorage.app",
  messagingSenderId: "611590783040",
  appId: "1:611590783040:web:f3936abeb439d74e235fa5",
  measurementId: "G-BCKRN47Q92"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
