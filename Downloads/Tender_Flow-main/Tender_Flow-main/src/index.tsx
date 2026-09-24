import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 1. Capture the ID from the environment
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// 2. Immediate Debug Logging
console.log("Environment Check - Client ID:", clientId ? "FOUND" : "NOT FOUND");

if (!clientId) {
  console.error("CRITICAL: VITE_GOOGLE_CLIENT_ID is missing. Check your .env file at the project root.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    {/* 3. Safety Fallback: 
      We pass an empty string if clientId is missing to avoid the "text=undefined" 
      error in the Google button component.
    */}
    <GoogleOAuthProvider clientId={clientId || ""}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);