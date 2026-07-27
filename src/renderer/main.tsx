import React from 'react'
import ReactDOM from 'react-dom/client'
import { ElectronAPI } from './preload'

// Extend the Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Basic UI component structure
function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1 style={{ color: '#333' }}>Video Automation Studio</h1>
      <p style={{ color: '#666' }}>Create and manage your AI video creation workflows here.</p>
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <p>System Status: Ready</p>
      </div>
    </div>
  )
}

// Initialize the React app
const rootElement = document.getElementById('root')
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}